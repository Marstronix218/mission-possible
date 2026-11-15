-- Every city on the mission map is now playable. Widen the classroom mission check
-- to the full slug list in src/lib/missions/registry.ts (missionSlugs).
alter table public.classrooms drop constraint if exists classrooms_mission_slug_check;
alter table public.classrooms add constraint classrooms_mission_slug_check check (mission_slug in (
 'los-angeles','san-francisco','phoenix','chicago','seattle','houston','st-louis','atlanta','new-york-city',
 'denver','minneapolis','boston','salt-lake-city','oklahoma-city','miami','new-orleans','anchorage','hilo'
));
