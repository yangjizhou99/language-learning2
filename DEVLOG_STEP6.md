# DEVLOG Step 6

## What we built
- Added duration_sec and difficulty columns to sessions table
- Cloze: 
  - Auto/manual difficulty selection
  - Duration tracking
  - Difficulty recommendation based on past scores
- SFT:
  - Three difficulty levels (basic/standard/advanced)
  - Duration tracking
  - Automatic difficulty adjustment based on scores
- Review page:
  - Line chart showing 14-day trends (count and average score)
  - Bar chart showing time usage by task type
  - Radar chart showing SFT rubric scores
  - Weekly report export (Markdown format)

## How to run
1. Execute SQL to add columns (handled by user)
2. Install dependencies: `pnpm add recharts`
3. Run dev server: `pnpm dev`
4. Test features:
   - /practice/cloze - verify difficulty selection and timing
   - /practice/sft - verify difficulty levels and timing
   - /review - verify charts and report export

## Screenshots
- public/step6-charts.png (showing all three chart types)
- public/step6-report.png (showing exported markdown)

## Notes/Issues
- Shadowing audio URLs may expire after a few days (noted in report)
- Difficulty recommendations are based on simple heuristics
- Charts will only show data after completing some practice sessions
