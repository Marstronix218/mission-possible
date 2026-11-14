import {TeacherDashboard} from '@/components/results/ClassroomUI';
export default async function Page({searchParams}:{searchParams:Promise<{authError?:string}>}){const q=await searchParams;return <TeacherDashboard authError={q.authError}/>}
