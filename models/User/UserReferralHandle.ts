import {Schema, type Model, models, model } from "mongoose"

export interface IUserReferalHandle {
    userId: string;
    referralHandle:string
}

const UserReferralHandleSchema = new Schema<IUserReferalHandle>({
    userId:{type:String, required:true, unique:true},
    referralHandle:{type:String, required:true}
})

export const UserReferralHandle: Model<IUserReferalHandle> =
  (models.UserReferralHandle as Model<IUserReferalHandle>) || model<IUserReferalHandle>("UserReferalHandle", UserReferralHandleSchema);