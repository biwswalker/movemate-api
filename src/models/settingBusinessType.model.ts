import { prop as Property, Ref, getModelForClass, plugin, ReturnModelType, DocumentType } from '@typegoose/typegoose'
import { Field, ID, ObjectType } from 'type-graphql'
import UpdateHistoryModel, { UpdateHistory } from './updateHistory.model'
import mongooseAutoPopulate from 'mongoose-autopopulate'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import { User } from './user.model'
import { Schema, Types } from 'mongoose'
import { SettingBusinessTypeInput } from '@inputs/settings.input'
import lodash, { filter, get, isEmpty, map, pick, uniq } from 'lodash'
import Aigle from 'aigle'

Aigle.mixin(lodash, {})

@ObjectType()
@plugin(mongooseAutoPopulate)
export class SettingBusinessType extends TimeStamps {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @Property()
  name: string

  @Field()
  @Property()
  available: boolean

  @Field({ defaultValue: 0 })
  @Property({ default: 0 })
  seq: number

  @Field(() => [UpdateHistory], { nullable: true })
  @Property({ ref: () => UpdateHistory, default: [], autopopulate: true })
  history: Ref<UpdateHistory>[]

  @Field()
  @Property({ default: Date.now })
  createdAt: Date

  @Field()
  @Property({ default: Date.now })
  updatedAt: Date

  @Property({ ref: () => User, type: Schema.Types.ObjectId, required: false })
  modifiedBy?: Ref<User>

  static async bulkUpsertAndMarkUnused(
    this: ReturnModelType<typeof SettingBusinessType>,
    data: SettingBusinessTypeInput[],
    userId: string,
  ): Promise<DocumentType<SettingBusinessType>[]> {
    const bulkOperations = []
    const updateHistories: DocumentType<UpdateHistory>[] = []
    const providedIds: string[] = []

    await Aigle.forEach(data, async ({ _id, name, seq }) => {
      let businessType = _id ? await this.findById(_id) : null

      const beforeUpdate = businessType ? businessType.toObject() : {}
      const beforeUpdatePick = pick(beforeUpdate, ['name', 'available', 'seq'])

      if (!businessType) {
        businessType = new SettingBusinessTypeModel()
      }

      Object.assign(businessType, { name, seq })

      const afterUpdatePick = pick(businessType, ['name', 'available', 'seq'])

      const hasChanged = JSON.stringify(beforeUpdatePick) !== JSON.stringify(afterUpdatePick)

      const newId = new Types.ObjectId(_id)

      providedIds.push(newId.toString())

      if (hasChanged) {
        const updateHistory = new UpdateHistoryModel({
          referenceId: newId.toString(),
          referenceType: 'SettingBusinessType',
          who: userId,
          beforeUpdate: beforeUpdatePick,
          afterUpdate: afterUpdatePick,
        })

        updateHistories.push(updateHistory)
        bulkOperations.push({
          updateOne: {
            filter: { _id: newId },
            update: {
              $set: { name, seq, modifiedBy: new Types.ObjectId(userId) },
              $setOnInsert: { available: true },
              $push: { history: updateHistory },
            },
            upsert: true,
          },
        })
      }
    })

    if (bulkOperations.length > 0) {
      await SettingBusinessTypeModel.bulkWrite(bulkOperations)
      await UpdateHistoryModel.insertMany(updateHistories)
    }

    if (providedIds.length > 0) {
      await SettingBusinessTypeModel.deleteMany({
        _id: { $nin: providedIds.map((id) => new Types.ObjectId(id)) },
      })
    }

    return this.find({ available: true })
  }

  static async findAvailable(): Promise<DocumentType<SettingBusinessType>[]> {
    return SettingBusinessTypeModel.find({ available: true }).sort({ seq: 1 })
  }
}

const SettingBusinessTypeModel = getModelForClass(SettingBusinessType)

export default SettingBusinessTypeModel
