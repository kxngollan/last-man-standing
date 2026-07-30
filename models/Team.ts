import { Schema, model, models, type Model, type Types } from "mongoose";

export interface ITeam {
  _id: Types.ObjectId;
  apiId: number; // football-data.org team id
  name: string;
  shortName: string;
  tla: string; // three-letter abbreviation, e.g. "ARS"
  crest?: string; // crest image URL
}

const TeamSchema = new Schema<ITeam>({
  apiId: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  shortName: { type: String, required: true },
  tla: { type: String, required: true },
  crest: { type: String },
});

export const Team: Model<ITeam> =
  (models.Team as Model<ITeam>) || model<ITeam>("Team", TeamSchema);
