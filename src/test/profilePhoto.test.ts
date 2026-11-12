import {describe,expect,it} from 'vitest';
import {cropRectangle,photoMime,privatePhotoPath,PROFILE_PHOTO_PREFIX} from '@/lib/profilePhoto';
describe('profile photo preparation',()=>{
 it('rejects renamed text and SVG files',()=>{
  expect(photoMime(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
  expect(photoMime(new TextEncoder().encode('pretend-photo.jpg'))).toBeNull();
 });
 it('keeps crop inside the original image at every edge',()=>{
  for(const width of [200,800])for(const height of [300,900])for(const zoom of [1,2,3])for(const x of [-100,100])for(const y of [-100,100]){
   const crop=cropRectangle(width,height,zoom,x,y);
   expect(crop.left).toBeGreaterThanOrEqual(0);expect(crop.top).toBeGreaterThanOrEqual(0);
   expect(crop.left+crop.side).toBeLessThanOrEqual(width+.00001);expect(crop.top+crop.side).toBeLessThanOrEqual(height+.00001);
  }
 });
 it('recognizes only owned-format private references without traversal',()=>{
  const path='10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000002.webp';
  expect(privatePhotoPath(PROFILE_PHOTO_PREFIX+path)).toBe(path);
  expect(privatePhotoPath(PROFILE_PHOTO_PREFIX+'../another/avatar.webp')).toBeNull();
  expect(privatePhotoPath('https://example.test/avatar.png')).toBeNull();
 });
});
