# Sphere Login Fix — Instructions

## Files Included
```
src/
├── pages/
│   ├── LoginPage.tsx            ← Replace your current file
│   ├── ForgotPasswordPage.tsx   ← Replace your current file
│   └── CategorySelectionPage.tsx← Replace your current file
├── contexts/
│   └── AuthContext.tsx          ← Replace your current file
└── styles/
    └── dvh-fix.css              ← NEW — add import to index.css
supabase-db-fix.sql              ← Run in Supabase SQL Editor FIRST
```

---

## STEP 1 — Run the SQL Fix (MOST IMPORTANT)
1. Go to Supabase Dashboard → SQL Editor
2. Paste the contents of `supabase-db-fix.sql`
3. Click **Run**
4. You should see: `Sphere DB fix applied successfully ✅`

This fixes:
- Database trigger that was failing (causing "database error saving new user")
- Adds `gender`, `dob`, `language`, `email` columns
- Creates `user_categories` table for interest saving
- Backfills email for existing users (needed for username login)

---

## STEP 2 — Replace the 4 files
Copy the files into your project replacing the existing ones.

---

## STEP 3 — Add the dvh fix to index.css
Open `src/styles/index.css` and add this line near the top:
```css
@import './dvh-fix.css';
```
```
---

## What's Fixed

### Mobile (Android)
- ✅ "sphere / Your world. Your voice." centered in header
- ✅ Welcome back message now shows on login screen
- ✅ Login with username (no @ required)
- ✅ Email/password inputs below welcome message
- ✅ Blue info box replaced with ℹ️ circular button — tapping shows modal
- ✅ Info modal shows automatically on step 2 entry, closes on tap-outside
- ✅ PIN auto-advances from "Create PIN" to "Confirm PIN" on 4-digit entry
- ✅ Smaller star-in-circle PIN indicators
- ✅ Cylindrical/pill design for all inputs and buttons
- ✅ Org account toggle removed
- ✅ Username limit increased to 14 characters
- ✅ DOB enforces 14+ (max date blocks underage selection)

### PC/Tablet
- ✅ Left panel: ONLY your login_icon.jpg — no text/overlay on top
- ✅ Image fixed/no scroll (position:absolute inset-0)
- ✅ Welcome back with extra India social platform card
- ✅ Login/Register tabs never jump position
- ✅ 55/45 split ratio

### All Pages
- ✅ 100dvh fix — browser bar appears/disappears without pushing content

### Database
- ✅ gender saved ✅ dob saved ✅ language saved ✅ anon_pin saved
- ✅ Email stored in profiles (enables username login)
- ✅ Trigger is fault-tolerant (won't fail auth signup on profile error)

### CategorySelectionPage
- ✅ Smaller transparent-style emoji icons (4-column grid)
- ✅ 20 categories total (added Comedy, Business, News, Spirituality)
- ✅ Sub-categories expand per parent (Sports→Cricket/Football/Badminton etc.)
- ✅ Saves language selection to database
- ✅ Saves category selections to user_categories table

### ForgotPasswordPage
- ✅ Content positioned at top (shifted up)
- ✅ Actually calls Supabase resetPasswordForEmail (was a dummy setTimeout before)
