import { GraphQLContext } from "@configs/graphQL.config";
import { ELimiterType, verifyRequestLimiter } from "@configs/rateLimit";
import UserModel, { EUserStatus, EUserType } from "@models/user.model";
import { REPONSE_NAME } from "constants/status";
import { GraphQLError } from "graphql";
import { MiddlewareFn } from "type-graphql";

export const RequestLimiterGuard: MiddlewareFn<GraphQLContext> = async (
  { context },
  next
) => {
  const { req } = context;
  const user_id = req.user_id
  const limit = req.limit
  if (user_id) {
    const userModel = await UserModel.findById(user_id)
    if (userModel) {
      if (userModel.userType === EUserType.BUSINESS) {
        if (userModel.status !== EUserStatus.ACTIVE) {
          const message = `คุณไม่สามารถใช้ฟังก์ชั่นการค้นหาราคาได้เนื่องจาก บัญชีของคุณโดนระงับ กรุณาติดต่อเจ้าหน้าที่`
          throw new GraphQLError(message, {
            extensions: { code: REPONSE_NAME.SEARCH_BANNED, errors: [{ message }] },
          })
        }
      }
    }
  }

  await verifyRequestLimiter(req.ip, ELimiterType.LOCATION, limit)

  return next()
};