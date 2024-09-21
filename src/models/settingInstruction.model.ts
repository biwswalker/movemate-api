import { prop as Property, Ref, getModelForClass, plugin, ReturnModelType, DocumentType } from '@typegoose/typegoose'
import { Field, ID, ObjectType } from 'type-graphql'
import UpdateHistoryModel, { UpdateHistory } from './updateHistory.model'
import mongooseAutoPopulate from 'mongoose-autopopulate'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import { User } from './user.model'
import { Schema, Types } from 'mongoose'
import { SettingInstructionInput } from '@inputs/settings.input'
import lodash, { filter, get, isEmpty, map, pick, uniq } from 'lodash'
import Aigle from 'aigle'

Aigle.mixin(lodash, {});

@ObjectType()
@plugin(mongooseAutoPopulate)
export class SettingInstruction extends TimeStamps {
    @Field(() => ID)
    readonly _id: string

    @Field()
    @Property()
    page: string

    @Field({ nullable: true })
    @Property()
    instruction: string

    @Field()
    @Property()
    instructionTitle: string

    @Field(() => [UpdateHistory], { nullable: true })
    @Property({ ref: () => UpdateHistory, default: [], autopopulate: true })
    history: Ref<UpdateHistory>[];

    @Field()
    @Property({ default: Date.now })
    createdAt: Date;

    @Field()
    @Property({ default: Date.now })
    updatedAt: Date;

    @Property({ ref: () => User, type: Schema.Types.ObjectId, required: false })
    modifiedBy?: Ref<User>;

    static async bulkUpsertAndMarkUnused(this: ReturnModelType<typeof SettingInstruction>, data: SettingInstructionInput[], userId: string): Promise<DocumentType<SettingInstruction>[]> {

        const bulkOperations = [];
        const updateHistories: DocumentType<UpdateHistory>[] = [];

        await Aigle.forEach(data, async ({ _id, instruction, instructionTitle, page }) => {
            let instructionData = _id ? await this.findById(_id) : null

            const beforeUpdate = instructionData
                ? instructionData.toObject()
                : {};
            const beforeUpdatePick = pick(beforeUpdate, ["instruction", "instructionTitle", "page"]);

            if (!instructionData) {
                instructionData = new SettingInstructionModel();
            }

            Object.assign(instructionData, { instruction, instructionTitle, page });

            const afterUpdatePick = pick(instructionData, ["instruction", "instructionTitle", "page"]);

            const hasChanged =
                JSON.stringify(beforeUpdatePick) !== JSON.stringify(afterUpdatePick);

            const newId = new Types.ObjectId(_id)

            if (hasChanged) {
                const updateHistory = new UpdateHistoryModel({
                    referenceId: newId.toString(),
                    referenceType: "SettingInstruction",
                    who: userId,
                    beforeUpdate: beforeUpdatePick,
                    afterUpdate: afterUpdatePick,
                });

                updateHistories.push(updateHistory);
                bulkOperations.push({
                    updateOne: {
                        filter: { _id: newId },
                        update: {
                            $set: { instruction, instructionTitle, page, modifiedBy: new Types.ObjectId(userId) },
                            $push: { history: updateHistory },
                        },
                        upsert: true,
                    },
                });
            }
        });

        if (bulkOperations.length > 0) {
            const originalIds = map(filter(data, item => !isEmpty(item._id)), item => item._id)
            const instructionIds = map(bulkOperations, (opt) =>
                get(opt, "updateOne.filter._id", "")
            );
            const protectedIds = uniq([...originalIds, ...instructionIds])
            await SettingInstructionModel.bulkWrite(bulkOperations);
            await UpdateHistoryModel.insertMany(updateHistories);
            await SettingInstructionModel.deleteMany({ _id: { $nin: protectedIds } })
        }

        return this.find()
    }
}

const SettingInstructionModel = getModelForClass(SettingInstruction)

export default SettingInstructionModel
