import { redirect } from 'next/navigation';

export default function ChineseShadowingPracticePage() {
  // Keep stable subpath, redirect to unified page with lang param
  redirect('/practice/shadowing?lang=zh');
}
