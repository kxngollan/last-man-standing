import { Schema, model } from "mongoose";

const TeamSchema = new Schema({
  name: { type: String, required: true },
  league: { type: String },
});

const Team = model("team", TeamSchema);

export default Team;
