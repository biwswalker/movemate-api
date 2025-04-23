import { EUserType } from "@enums/users"
import UserModel, { User } from "@models/user.model"
import { GraphQLError } from "graphql"


export async function getAgentParents(userId: string): Promise<User[]> {
  try {
    const driver = await UserModel.findById(userId).lean()
    const parents = await UserModel.find({ _id: { $in: driver.parents }, userType: EUserType.BUSINESS })
    return parents
  } catch (error) {
    console.log(error)
    throw new GraphQLError('ไม่สามารถเรียกรายการนายหน้าได้ โปรดลองอีกครั้ง')
  }
}
