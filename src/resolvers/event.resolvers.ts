import { EUserRole } from '@enums/users'
import { AuthGuard } from '@guards/auth.guards'
import { EventInput } from '@inputs/event.input'
import EventModel, { Event } from '@models/event.model'
import { DocumentType } from '@typegoose/typegoose'
import { yupValidationThrow } from '@utils/error.utils'
import { EventSchema } from '@validations/event.validations'
import { endOfMonth, startOfMonth } from 'date-fns'
import { Types } from 'mongoose'
import { Arg, Mutation, Query, Resolver, UseMiddleware } from 'type-graphql'
import { ValidationError } from 'yup'

@Resolver(Event)
export default class EventResolver {
  @Query(() => [Event])
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async events(@Arg('date') date: Date): Promise<Event[]> {
    const som = startOfMonth(date)
    const eom = endOfMonth(date)
    const events = await EventModel.find({
      $or: [{ start: { $gte: som, $lte: eom } }, { end: { $gte: som, $lte: eom } }],
    })
      .sort({ createdAt: 1 })
      .exec()
    return events
  }

  @Query(() => Event)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async event(@Arg('eventName') eventName: string): Promise<Event> {
    const event = await EventModel.findOne({ title: eventName })
    return event
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async saveEvent(@Arg('data') { _id, ...data }: EventInput): Promise<boolean> {
    try {
      await EventSchema.validate({ id: _id, ...data }, { abortEarly: false })
      const _: DocumentType<Event> = await EventModel.findOneAndUpdate(
        { _id: new Types.ObjectId(_id) },
        data,
        {
          newL: true,
          upsert: true,
        },
      )

      return true
    } catch (errors) {
      console.log('error: ', errors)
      if (errors instanceof ValidationError) {
        throw yupValidationThrow(errors)
      }
      throw errors
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthGuard([EUserRole.ADMIN]))
  async removeEvent(@Arg('eventId') eventId: string): Promise<boolean> {
    await EventModel.findByIdAndDelete(eventId)
    return true
  }
}
