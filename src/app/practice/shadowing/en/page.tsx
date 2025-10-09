import { redirect } from 'next/navigation';

export default function EnglishShadowingPracticePage() {
  // Keep stable subpath, redirect to unified page with lang param
  redirect('/practice/shadowing?lang=en');
}
