import { Schema, model, models, type Model, type Types } from "mongoose";

export interface ITeam {
  _id: Types.ObjectId;
  apiId: number; // football-data.org team id
  name: string;
  shortName: string;
  tla: string; // three-letter abbreviation, e.g. "ARS"
  /**
   * The club's own badge, on football-data.org's CDN, exactly as the API gave
   * it. Kept whatever CREST_STYLE currently says, so the original is never lost
   * to a sync run under the wrong setting and switching back costs nothing.
   *
   * Not necessarily what gets rendered — see `pCrest` and lib/crests.ts.
   */
  crest?: string | null;
  /**
   * Our pixelated copy of the badge: a path on our own domain, like
   * "/crests/ARS.png", written by scripts/pixelate-crests.py and served out of
   * public/crests. Null for a club we could not pixelate (an SVG source,
   * usually), which falls back to the lettered disc.
   *
   * A path rather than an absolute URL because the website renders it straight
   * into `src` and the app's Crest component resolves a leading slash against
   * its API host — one stored value serves both, and neither breaks if the
   * domain changes.
   */
  pCrest?: string | null;
}

const TeamSchema = new Schema<ITeam>({
  apiId: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  shortName: { type: String, required: true },
  tla: { type: String, required: true, index: true },
  crest: { type: String },
  pCrest: { type: String },
});

export const Team: Model<ITeam> =
  (models.Team as Model<ITeam>) || model<ITeam>("Team", TeamSchema);
