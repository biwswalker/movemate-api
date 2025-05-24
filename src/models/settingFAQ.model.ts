import { prop as Property, Ref, getModelForClass, plugin, ReturnModelType, DocumentType } from '@typegoose/typegoose'
import { Field, ID, ObjectType } from 'type-graphql'
import UpdateHistoryModel, { UpdateHistory } from './updateHistory.model'
import mongooseAutoPopulate from 'mongoose-autopopulate'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import { User } from './user.model'
import { Schema, Types } from 'mongoose'
import { SettingFAQInput } from '@inputs/settings.input'
import lodash, { filter, get, isEmpty, map, pick, uniq } from 'lodash'
import Aigle from 'aigle'

Aigle.mixin(lodash, {})

@ObjectType()
@plugin(mongooseAutoPopulate)
export class SettingFAQ extends TimeStamps {
  @Field(() => ID)
  readonly _id: string

  @Field()
  @Property({ unique: true })
  question: string

  @Field()
  @Property()
  answer: string

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
    this: ReturnModelType<typeof SettingFAQ>,
    data: SettingFAQInput[],
    userId: string,
  ): Promise<DocumentType<SettingFAQ>[]> {
    const bulkOperations = []
    const updateHistories: DocumentType<UpdateHistory>[] = []
    const providedIds: string[] = []

    await Aigle.forEach(data, async ({ _id, question, answer }) => {
      let faq = _id ? await this.findById(_id) : null
      const beforeUpdate = faq ? faq.toObject() : {}
      const beforeUpdatePick = pick(beforeUpdate, ['question', 'answer'])

      if (!faq) {
        faq = new SettingFAQModel()
      }

      Object.assign(faq, { question, answer })

      const afterUpdatePick = pick(faq, ['question', 'answer'])

      const hasChanged = JSON.stringify(beforeUpdatePick) !== JSON.stringify(afterUpdatePick)

      const newId = new Types.ObjectId(_id)

      providedIds.push(newId.toString())

      if (hasChanged) {
        const updateHistory = new UpdateHistoryModel({
          referenceId: newId.toString(),
          referenceType: 'SettingFAQ',
          who: userId,
          beforeUpdate: beforeUpdatePick,
          afterUpdate: afterUpdatePick,
        })

        updateHistories.push(updateHistory)
        bulkOperations.push({
          updateOne: {
            filter: { _id: newId },
            update: {
              $set: { question, answer, modifiedBy: new Types.ObjectId(userId) },
              $push: { history: updateHistory },
            },
            upsert: true,
          },
        })
      }
    })

    if (bulkOperations.length > 0) {
      await SettingFAQModel.bulkWrite(bulkOperations)
      await UpdateHistoryModel.insertMany(updateHistories)
    }

    if (providedIds.length > 0) {
      await SettingFAQModel.deleteMany({
        _id: { $nin: providedIds.map((id) => new Types.ObjectId(id)) },
      })
    }
    return this.find()
  }
}

const SettingFAQModel = getModelForClass(SettingFAQ)

export default SettingFAQModel
