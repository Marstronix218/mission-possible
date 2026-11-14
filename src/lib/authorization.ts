// Authorization uses the server-read profile role, never client user metadata.
export function canManageClassrooms(user:{is_anonymous?:boolean;email_confirmed_at?:string},profileRole:string|null|undefined):boolean{
 return user.is_anonymous===false&&!!user.email_confirmed_at&&profileRole==='teacher';
}
