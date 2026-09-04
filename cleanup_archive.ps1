# Velmora Manager cleanup - archives old dev-history docs and backup files
# into an _archive folder. Nothing is deleted. Safe to re-run.
#
# Run this from inside the "Velmora Manager" folder (double-click it, or
# right-click > Run with PowerShell, or `powershell -ExecutionPolicy Bypass -File cleanup_archive.ps1`).

$ErrorActionPreference = 'Continue'
Set-Location -Path $PSScriptRoot

$archiveRoot = Join-Path $PSScriptRoot '_archive'
$backupsDir  = Join-Path $archiveRoot 'backups'
$devNotesDir = Join-Path $archiveRoot 'dev-notes'

New-Item -ItemType Directory -Force -Path $backupsDir  | Out-Null
New-Item -ItemType Directory -Force -Path $devNotesDir | Out-Null

$backupItems = @(
    '_v44_backup',
    '_v45_backup',
    'aaa-career-pass.css.v41.bak',
    'aaa-career-pass.css.v42.bak',
    'app.js.v41.bak',
    'app.js.v42.bak',
    'career-expansion.js.v40.bak',
    'index.html.v41.bak',
    'index.html.v42.bak',
    'package.json.v42.bak',
    'v19_5_1_badge_news_fix'
)

$devNotesItems = @(
    'CHANGELOG_GUI_ART_INTEGRATION.md',
    'CHANGELOG_PHASE2.md',
    'CHANGELOG_PHASE3.md',
    'CHANGELOG_PHASE3_1_SCOUTING.md',
    'CHANGELOG_PHASE3_2_LIFECYCLE.md',
    'CHANGELOG_PHASE4_OFFICE.md',
    'INSTALL.txt',
    'INSTALL_V33.txt',
    'INSTALL_V34.txt',
    'INSTALL_V35.txt',
    'INSTALL_V36_1_STAFF_FIX.txt',
    'INSTALL_V36_OFFICE.txt',
    'INSTALL_V37_CORRESPONDENCE.txt',
    'INSTALL_V38_1_FULL_WIDTH.txt',
    'INSTALL_V38_CLUB_POST.txt',
    'INSTALL_V38_UPDATE.txt',
    'INSTALL_V39_RECRUITMENT.txt',
    'INSTALL_V40_FUTURE_TRANSFERS.txt',
    'MATCHDAY_IMPLEMENTATION_PROMPT.md',
    'OUTFIT_FIT_QC.jpg',
    'PATCH_README_GUI_ART.txt',
    'PATCH_V14_README.txt',
    'PATCH_V16_README.txt',
    'PATCH_V17.3_README.txt',
    'PATCH_V17.4_README.txt',
    'PATCH_V17_README.txt',
    'PHASE2_SQUAD_PREVIEW.png',
    'PHASE3_TRANSFERS_PREVIEW.png',
    'QA_V20.6.1.txt',
    'QA_V20.6.2.txt',
    'README.md',
    'README.txt',
    'README_CAREER_INTEGRITY.md',
    'README_CENTRAL_NEWS.txt',
    'README_MATCHDAY_MANAGEMENT.md',
    'README_PATCH.txt',
    'README_PLAYER_QUALITY.md',
    'README_QUAFFLE_UPDATE.md',
    'README_SPRITE_REPAIR.md',
    'README_STADIUM_ROUTING.md',
    'README_TRAINING_READINESS.md',
    'README_V17.6.txt',
    'README_V18.1.txt',
    'README_V18.2.txt',
    'README_V18.3.txt',
    'README_V18.4.txt',
    'README_V18.5.txt',
    'README_V18.6.txt',
    'README_V18.7.txt',
    'README_V18.8.txt',
    'README_V18_CREATE_A_MANAGER.txt',
    'README_V19.6.1.txt',
    'README_V19_PHASE1.txt',
    'README_V20.5.2_NEWS_INBOX_PATCH.txt',
    'README_V20.5.3.1_MANAGER_NOTIFICATIONS_HOTFIX.txt',
    'README_V20.5.3.2_MANAGER_PORTRAIT_HOTFIX.txt',
    'README_V20.5.3_MATCHDAY_SCOUTING_AAA_PATCH.txt',
    'README_V20.5.4_STABILITY_INTERACTION_PASS.txt',
    'README_V20.5.5.1_YOUTH_LAYOUT_REPAIR.txt',
    'README_V20.5.5.2_YOUTH_VISIBILITY_REPAIR.txt',
    'README_V20.5.5_YOUTH_ACADEMY_AAA_PASS.txt',
    'README_V20.6.1_LIVING_WORLD_MANAGER_ECOSYSTEM.txt',
    'README_V20.6.2_PLAYER_STORIES_DRESSING_ROOM.txt',
    'README_V20.6.5.1_INSTANT_TRANSFER_RESPONSE_HOTFIX.txt',
    'README_V20.6.5_AAA_NEGOTIATION_ENGINE.txt',
    'README_V20.6.6_WORLD_HISTORY_AWARDS_MANAGER_LEGACY.txt',
    'README_V20.7.1_MATCHDAY_STAKES_OCCASION_ENGINE.txt',
    'README_V20.7.2_TROPHY_PROMOTION_SEASON_FINALE.txt',
    'README_V20.7.3.1_CAREER_MUSIC_PLAYLIST.txt',
    'README_V20.7.3.2_NOW_PLAYING_VISIBILITY_HOTFIX.txt',
    'README_V20.7.3.3.1_INBOX_MODULE_SCALE_HOTFIX.txt',
    'README_V20.7.3.3.2_INBOX_PORTRAIT_DIVERSITY.txt',
    'README_V20.7.3.3_OFFICE_INBOX_WORLD_IDENTITY.txt',
    'README_V20.7.3_CAREER_PACING_SEASONAL_VARIETY.txt',
    'README_V20.7.4_AI_CLUB_INTELLIGENCE_MANAGER_TACTICAL_IDENTITY.txt',
    'README_V20.7.5_PLAYER_DEVELOPMENT_CONTRACTS_CAREER_PATHWAYS.txt',
    'README_V20.7.6_UNEXPECTED_EVENTS_2.txt',
    'README_V20.7.6_UNEXPECTED_EVENTS_2_LIVING_CLUB_SITUATIONS.txt',
    'README_V20.7.7_FC_STYLE_CENTRAL_TASK_LIST_CAREER_QOL.txt',
    'README_V20.8_NEW_SEASON_PRESEASON_EXPERIENCE.txt',
    'README_V21.0_LIVE_QUIDDITCH_ENGINE_TORRE_PICCOLA.txt',
    'README_V21.1.txt',
    'README_V21.2_MATCHDAY_LOOP_AND_LEAGUE_ONE_STADIUMS.txt',
    'README_V26.1_NAME_DIVERSITY.md',
    'README_V26.2_MATCHDAY_BROADCAST_PRESENTATION.md',
    'README_V26.3_CENTRAL_PRESENTATION_REBUILD.txt',
    'README_V26.4_MATCHDAY_TEAM_SHEET_REBUILD.txt',
    'README_V26_DISCIPLINE_CARDS_SUSPENSIONS.md',
    'README_V27.1_MATCHDAY_LAYOUT_AND_LOAN_RETURN_FIX.txt',
    'README_V27_MATCHDAY_WINGS_REDESIGN.txt',
    'README_V28_CENTRAL_REBUILD.txt',
    'README_V29_ENDGAME_RESULTS_REWORK.txt',
    'README_V30_ENDGAME_VISUAL_REBUILD.txt',
    'README_V31_TRANSFER_RECRUITMENT.md',
    'README_V32_CAREER_MARKET_SAVES.md',
    'README_V33_LIVING_NEWSROOM.md',
    'README_V34_CAREER_EXPANSION.md',
    'README_V35_INTEGRATION.md',
    'README_V41_AAA_CAREER_CLUB_LIFE.md',
    'README_V43_LIVING_STATISTICS.md',
    'README_V46.1_MATCHDAY_STABILITY.md',
    'README_V46.2_INTERFACE_THEMES.md',
    'README_V46_MATCHDAY_LIVING_ENVIRONMENTS.md',
    'README_V47_1_PORTRAIT_FIX.txt',
    'README_V47_MATCHDAY_UPDATE.txt',
    'README_V48_UPDATE.txt',
    'README_V49_UPDATE.txt',
    'SHA256SUMS.txt',
    'START_HERE.txt',
    'TRAINING_IMPLEMENTATION_PROMPT.md',
    'V19.1.1_CUSTOMIZATION_REPAIR_REPORT.md',
    'V19.1.2_WARDROBE_PREVIEW_AND_ARM_FIX_REPORT.md',
    'V19.1_CUSTOMIZATION_INTEGRATION_REPORT.md',
    'V19.2.1_LIVE_UNEMPLOYED_WORLD_REPORT.md',
    'V19.2_FIRST_APPOINTMENT_JOB_MARKET_REPORT.md',
    'V19.3.1_UI_READABILITY_AND_SPRITE_FIX_REPORT.md',
    'V19.3.2_REALISTIC_RECRUITMENT_RECOMMENDATIONS_REPORT.md',
    'V19.3_WELCOME_TO_THE_JOB_REPORT.md',
    'V19.4.1_PATCH_README.md',
    'V19.4.2_PATCH_README.md',
    'V19.4.3_PATCH_README.md',
    'V19.4_LIVING_CAREER_REPORT.md',
    'V19.8_CHAMPIONS_CROWN_MASTER_PROMPT.txt',
    'V20.4_CALENDAR_WORLD_BROWSER_CLUB_PROFILES.md',
    'V20.6.1_LIVING_WORLD_MANAGER_ECOSYSTEM_MASTER_PROMPT.txt',
    'V20.6.2_PLAYER_STORIES_DRESSING_ROOM_MASTER_PROMPT.txt',
    'V20.6.3_MEDIA_NARRATIVES_RIVALRIES_MASTER_PROMPT.txt',
    'V20.6.3_PATCH_README.txt',
    'V20.6.4_PATCH_README.txt',
    'V20.7.6_UNEXPECTED_EVENTS_2_LIVING_CLUB_SITUATIONS_MASTER_PROMPT.txt',
    'V20.7.7_FC_STYLE_CENTRAL_TASK_LIST_CAREER_QOL_MASTER_PROMPT.txt',
    'V20.8_NEW_SEASON_PRESEASON_EXPERIENCE_MASTER_PROMPT.txt',
    'V26.1_NAME_DIVERSITY_MASTER_PROMPT.md',
    'V26.1_PATCH_SHA256SUMS.txt',
    'V26.2_MATCHDAY_BROADCAST_QA.md',
    'V26_DISCIPLINE_CARDS_SUSPENSIONS_MASTER_PROMPT.md',
    'V26_PATCH_INSTALL.txt',
    'V26_QA_RESULTS.md',
    'V31_TRANSFER_RECRUITMENT_AAA_MASTER_PROMPT.md',
    'V32.2_STADIUM_WEBP_OPTIMIZATION_REPORT.md',
    'V32_CAREER_MARKET_SAVE_SYSTEMS_AAA_MASTER_PROMPT.md',
    'V32_SHA256SUMS.txt',
    'V33_LIVING_NEWSROOM_AAA_MASTER_PROMPT.md',
    'V34_SHA256SUMS.txt',
    'V35_SHA256SUMS.txt',
    'V36_SHA256SUMS.txt',
    'V37_SHA256SUMS.txt',
    'V38_1_SHA256SUMS.txt',
    'V38_SHA256SUMS.txt',
    'V39_SHA256SUMS.txt',
    'V40_SHA256SUMS.txt',
    'V41_AAA_CAREER_SHA256SUMS.txt',
    'V43_LIVING_STATISTICS_AAA_MASTER_PROMPT.md',
    'V44_LIVING_CLUB_MANAGER_WORLD_AAA_MASTER_PROMPT.md',
    'V45_RELEASE_GRADE_CAREER_MODE_AAA_MASTER_PROMPT.md',
    'V46_MATCHDAY_LIVING_ENVIRONMENTS_AAA_MASTER_PROMPT.md',
    'V46_SHA256SUMS.txt',
    'V49-Trait-Distribution-Audit.json',
    'reports',
    'sprite-review'
)

$moved = 0
$skipped = 0
$errors = 0

function Move-Listed {
    param([string[]]$Items, [string]$Destination, [string]$Label)

    foreach ($name in $Items) {
        $source = Join-Path $PSScriptRoot $name
        if (-not (Test-Path -LiteralPath $source)) {
            Write-Host "  [skip] $name (not found)" -ForegroundColor DarkYellow
            $script:skipped++
            continue
        }
        $target = Join-Path $Destination $name
        try {
            Move-Item -LiteralPath $source -Destination $target -Force -ErrorAction Stop
            Write-Host "  [$Label] $name"
            $script:moved++
        } catch {
            Write-Host "  [ERROR] $name : $($_.Exception.Message)" -ForegroundColor Red
            $script:errors++
        }
    }
}

Write-Host "Archiving backup files/folders into _archive\backups ..." -ForegroundColor Cyan
Move-Listed -Items $backupItems -Destination $backupsDir -Label 'backup'

Write-Host ""
Write-Host "Archiving old version docs/notes into _archive\dev-notes ..." -ForegroundColor Cyan
Move-Listed -Items $devNotesItems -Destination $devNotesDir -Label 'dev-notes'

Write-Host ""
Write-Host "Done. Moved: $moved   Skipped (already gone): $skipped   Errors: $errors" -ForegroundColor Green
Write-Host "Nothing was deleted - everything is now under the _archive folder."
Write-Host ""
Read-Host "Press Enter to close"
