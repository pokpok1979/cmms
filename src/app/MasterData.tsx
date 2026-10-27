"use client";
import Sites from "./Sites";
import Locations from "./Locations";
export default function MasterData(props:{kind:"sites"|"locations";onSaved:()=>void}){
  if (props.kind === "sites") return <Sites onSaved={props.onSaved} />;
  return <Locations onSaved={props.onSaved} />;
}
