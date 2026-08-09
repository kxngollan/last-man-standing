import {Schema, type Model, models, model } from "mongoose"

export interface IUserReferredBy {
    userId: string;
    referralHandle:string
}

const UserReferralHandleSchema = new Schema<IUserReferredBy>({
    userId:{type:String, required:true, unique:true},
    referralHandle:{type:String, required:true}
})

export const UserReferralHandle: Model<IUserReferredBy> =
  (models.UserReferralHandle as Model<IUserReferredBy>) || model<IUserReferredBy>("IUserRefferalHandle", UserReferralHandleSchema);