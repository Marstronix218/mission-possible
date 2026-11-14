import {describe,it,expect} from 'vitest';
import {canManageClassrooms} from '../src/lib/authorization';
describe('teacher authorization',()=>{
 const verified={is_anonymous:false,email_confirmed_at:'2026-11-14T00:00:00Z'};
 it('denies verified email accounts without an approved teacher profile',()=>{
  expect(canManageClassrooms(verified,'student')).toBe(false);
  expect(canManageClassrooms(verified,undefined)).toBe(false);
 });
 it('requires both verified sign-in and the server-read teacher role',()=>{
  expect(canManageClassrooms(verified,'teacher')).toBe(true);
  expect(canManageClassrooms({...verified,is_anonymous:true},'teacher')).toBe(false);
  expect(canManageClassrooms({is_anonymous:false},'teacher')).toBe(false);
 });
});
