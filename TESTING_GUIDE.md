# End-to-End Testing Guide

## Prerequisites

1. **Database migrations** - All migrations in database/migrations/ are run
2. **Worker running** - The Python worker should be running (or ready to run)
3. **Web app running** - Next.js dev server should be running
4. **Some test data** - At least a few posts with LLM scores in the database

## Test Flow

### 1. Verify Initial State

**Check Dashboard:**
- Navigate to `http://localhost:3000` (or your dev URL)
- Verify you can see posts with scores
- Check that posts are sorted by score

**Check Settings:**
- Navigate to `/settings`
- Verify you see the "Default (Migrated)" weight config
- Verify it shows as "Active"
- Verify you see any existing recompute jobs

### 2. Test Weight Config Creation & Recompute

**Create a new weight config:**
1. Go to `/settings`
2. Adjust the ranking weight sliders (e.g., set `absurdity` to 5.0)
3. Click "Save & Recompute Scores"
4. Verify:
   - Success message appears with job ID
   - New weight config appears in "Weight Configurations" section
   - New job appears in "Recompute Jobs" section with status "pending"
   - Job shows "Computing..." badge on the config

**Start the worker:**
```bash
cd scraper
set -a && source .env && set +a
./venv/bin/python -m src.worker --once
```

**Verify job processing:**
1. Refresh the settings page
2. Verify job status changes to "running" then "completed"
3. Verify progress updates (X / Y posts)
4. Verify config now shows "Activate" button (not "Computing...")

### 3. Test Weight Config Activation

**Activate the new config:**
1. Click "Activate" button on the completed config
2. Verify:
   - Success message appears
   - Config badge changes to "Active"
   - Previous config no longer shows "Active"

**Verify dashboard updates:**
1. Navigate to `/` (dashboard)
2. Refresh the page
3. Verify posts are re-sorted with new rankings
4. Verify different posts appear at the top (if weights changed significantly)

### 4. Test Job Cancellation

**Create another job:**
1. Adjust weights again (different values)
2. Click "Save & Recompute Scores"
3. Note the new job ID

**Cancel the job:**
1. While job is "pending" or "running", click "Cancel" button
2. Verify:
   - Success message appears
   - Job status changes to "cancelled"
   - Worker stops processing (if running)
   - Config shows no "Computing..." badge

### 5. Test Job Retry (if you can simulate a failure)

**Simulate a transient failure:**
- Temporarily break the database connection
- Create a new job
- Let it fail
- Restore connection
- Verify worker retries the job automatically

**Or check retry display:**
- If a job has retried, verify retry count shows in job details

### 6. Test Input Validation

**Test invalid weights:**
1. Try to save weights with value > 10
2. Verify error message appears
3. Try to save weights with missing dimension
4. Verify error message appears
5. Try to save weights with invalid dimension name
6. Verify error message appears

### 7. Test Search Defaults

**Update search threshold:**
1. Go to `/settings`
2. Adjust "Similarity Threshold" slider
3. Click "Save Search Defaults"
4. Verify success message

**Test search page:**
1. Navigate to `/search`
2. Verify threshold loads from defaults
3. Perform a search
4. Verify results use the new threshold

### 8. Test Config Deletion

**Delete a non-active config:**
1. Find a config that's not active
2. Click "Delete" button
3. Confirm deletion
4. Verify:
   - Config disappears from list
   - Success message appears
   - Associated scores are deleted (check database if needed)

**Try to delete active config:**
1. Try to delete the active config
2. Verify error message: "Cannot delete the active weight configuration"

### 9. Test Error Handling

**Test missing active config:**
- If you delete all configs (don't do this in production!):
  - Dashboard should show helpful error message
  - Should suggest creating/activating a config

**Test search defaults error:**
- Temporarily break `/api/settings` endpoint
- Navigate to `/search`
- Verify error message appears (not silent failure)

### 10. Test Metrics/Stats

**View job statistics:**
1. Go to `/settings`
2. Scroll to "Job Statistics" section (if jobs exist)
3. Verify stats display:
   - Total Jobs
   - Success Rate
   - Avg Duration
   - Completed count

### 11. Test Polling Features

**Test exponential backoff:**
1. Temporarily break API endpoints
2. Watch browser console
3. Verify polling intervals increase (5s → 7.5s → 11.25s → ...)
4. Restore endpoints
5. Verify polling resets to 5s

**Test tab visibility:**
1. Open settings page
2. Switch to another tab
3. Verify polling stops (check network tab)
4. Switch back
5. Verify polling resumes

## Quick Test Script

For a quick smoke test, run this sequence:

```bash
# 1. Start worker (in one terminal)
cd scraper
set -a && source .env && set +a
./venv/bin/python -m src.worker --once

# 2. In browser:
# - Go to /settings
# - Change absurdity to 3.0
# - Click "Save & Recompute Scores"
# - Wait for job to complete
# - Click "Activate"
# - Go to / (dashboard)
# - Verify posts are re-sorted
```

## Expected Results

After all tests, you should have:
- ✅ Multiple weight configs created
- ✅ Jobs processed successfully
- ✅ Configs can be activated/deactivated
- ✅ Dashboard reflects active config's scores
- ✅ Jobs can be cancelled
- ✅ Input validation works
- ✅ Search defaults work
- ✅ Configs can be deleted (non-active ones)
- ✅ Error messages are helpful
- ✅ Stats display correctly
- ✅ Polling works with backoff and tab visibility

## Troubleshooting

**Job stuck in "pending":**
- Check worker is running
- Check worker logs for errors
- Verify database connection

**Job fails immediately:**
- Check worker logs
- Verify `weight_config_id` exists in job params
- Check database for error_message

**Dashboard shows no posts:**
- Verify active_weight_config_id is set in settings
- Verify post_scores exist for active config
- Check browser console for errors

**Config won't activate:**
- Verify job completed successfully
- Verify config has scores (check has_scores column)
- Check browser console for errors
