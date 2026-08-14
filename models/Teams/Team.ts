import { Schema, model, models, type Model, type Types } from "mongoose";

export interface ITeam {
  _id: Types.ObjectId;
  apiId: number; // football-data.org team id
  name: string;
  shortName: string;
  tla: string; // three-letter abbreviation, e.g. "ARS"
  /**
   * Crest image URL, or null for none.
   *
   * Nullable rather than merely optional because null is a real state here:
   * CREST_STYLE=none stores it deliberately, and a $set has to be able to clear
   * a badge that a previous sync wrote. See lib/crests.ts.
   *
   * Usually a path on our own domain ("/crests/ARS.png") rather than an
   * absolute URL — the app's Crest component resolves it against its API host.
   */
  crest?: string | null;
  pCrest?:string | null;
}

const TeamSchema = new Schema<ITeam>({
  apiId: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  shortName: { type: String, required: true },
  tla: { type: String, required: true, index: true },
  crest: { type: String },
  pCrest:{type:String}
});

export const Team: Model<ITeam> =
  (models.Team as Model<ITeam>) || model<ITeam>("Team", TeamSchema);
