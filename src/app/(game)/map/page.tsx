import MissionMap from "@/components/map/MissionMap";
import { toMapMission } from "@/components/map/missions";
import { allMissions } from "@/lib/missions/registry";

export default function Page() {
  return <MissionMap missions={allMissions.map(toMapMission)} />;
}
