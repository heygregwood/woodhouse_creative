# Woodhouse Agency Creative Automation Workflow (Current State)

**Last Updated:** December 18, 2025  
**Purpose:** Document the end-to-end process for creating and distributing customized video content to Allied Air dealers

---

## Overview

This workflow creates personalized social media video content (Reels) for ~110 Allied Air dealers. Each video is customized with the dealer's logo, business name, and phone number, then scheduled for posting via Meta Business Manager.

**Key Constraint:** Manual upload and scheduling in Meta Business Manager cannot be automated (no Meta Graph API).

---

## Step 1: Create Base Template in Canva

**Location:** Canva (canva.com)

**Process:**
1. Design video template in Canva
2. Add extra space at the end for dealer customization (logo, business name, phone)
3. Save with naming convention: `Post ### C` where:
   - `###` = Sequential post number (e.g., 664, 665, 666)
   - `C` = Indicates "Customize" (not all dealers get customized versions)

**Output:** Download video file

**Save To:** `G:\Shared drives\Woodhouse Social\Creative Automation\Base Videos`

---

## Step 2: Create Creatomate Template

**Location:** Creatomate (creatomate.com)

**Process:**
1. Create new template in Creatomate
2. Name template: `Post ###` (matching Canva naming)
3. Upload base video from Step 1
4. Add dynamic elements:
   - `Public-Company-Name` (REQUIRED - used for export naming)
   - `Public-Company-Phone` (optional but typical)
   - `Logo` (optional but typical)
5. Design layout and test animations
6. Save template

**Template ID:** Available in URL after saving (format: `603f269d-8019-40b9-8cc5-b4e1829b05bd`)

**Screenshot Reference:** See Creatomate editor interface with dynamic elements on timeline

---

## Step 3: Prepare Dealer Data

### Source of Truth
**File:** `C:\Users\GregWood\OneDrive - woodhouseagency.com\Woodhouse Business\Woodhouse_Agency\Clients\AAE\Turnkey Social Media\Dealer Database\Turnkey Social Media - Dealers - Current.xlsm`

**Tab:** Woodhouse Data

### Validated Import File
**File:** `C:\Users\GregWood\OneDrive - woodhouseagency.com\Woodhouse Business\Creative Automation\Import Creatomate Data Validated.xlsx`

**Required Fields:**
| Field | Description | Example |
|-------|-------------|---------|
| Contact First Name | Primary contact | Derek |
| Phone Source | Where phone was verified | Facebook |
| Facebook Page ID | Meta page identifier | 104422128598122 |
| QA Confirmed | Quality check status | Y |
| Creatomate Company Phone | Formatted phone | 306-343-7781 |
| Creatomate Company Name | Business name | Aviation Mechanical LTD |
| Creatomate Web Address | Website (optional) | fondasplumbing.com |
| Creatomate Logo | Google Drive public URL | https://drive.google.com/file/d/... |
| Ready for automate | Automation status | yes |

### Logo Preparation
- Logos searched for manually or via tools
- Modified/cleaned as needed
- Uploaded to Google Drive with public sharing enabled
- URL stored in validated import file

**Potential Improvement:** Use Brandfetch integration for remaining dealers

---

## Step 4: Export Data for Creatomate

**Process:**
1. Filter dealers where "Ready for automate" = yes
2. Copy 4 fields to new CSV:
   - Company Name
   - Company Phone
   - Logo URL
   - (Web Address if applicable)

**Output:** `C:\Users\gregwood\Downloads\Creatomate Import North Validated.csv`

---

## Step 5: Batch Render in Creatomate

**Process:**
1. Open saved template in Creatomate
2. Click "Use Template" button
3. Select "Spreadsheet to Video" (Recommended option)
4. Select "Create new feed"
5. Import CSV from Step 4
6. Click "Render All" and wait for completion
7. Click "Download renders"
8. Choose "Company Name" as filename format
9. Download ZIP file to Downloads folder

**Output:** ZIP file containing all rendered videos named by company

**Unzip To:** Extract and save to Final Videos folder

---

## Step 6: Organize Videos to Dealer Folders

**Google Drive Location:** `G:\Shared drives\Woodhouse Social\Creative Automation\`

**Folder Structure:**
```
Creative Automation/
├── Base Videos/
├── Final_Videos/
│   └── Post ###/          ← Unzipped renders go here
├── Dealers/
│   ├── Aviation Mechanical LTD/
│   ├── Bird Ventilation and Gasfitting LTD/
│   ├── Fondas Plumbing and Heating/
│   └── [Each dealer has own folder]/
```

**Google Apps Script:** Run this script in Google Drive to rename and move files:

```javascript
function runVideoAutomation() {
  // --- USER ACTION REQUIRED: CHANGE THIS LINE FOR EACH NEW BATCH ---
  const templateName = 'Post 664'; // <-- UPDATE THIS to the new folder name
  // -----------------------------------------------------------------

  const creativeAutomationFolderId = '1jOmOJfLRvi2K8gZztoIxAad3cz72A16L'; 
  const fileExtension = '.mp4'; 

  Logger.log(`Starting process for template: ${templateName}`);

  const creativeAutomationFolder = DriveApp.getFolderById(creativeAutomationFolderId);
  
  // Locate Final_Videos folder
  const finalVideosFolderIterator = creativeAutomationFolder.getFoldersByName('Final_Videos');
  if (!finalVideosFolderIterator.hasNext()) {
    Logger.log('Error: "Final_Videos" folder not found inside "Creative Automation".');
    return;
  }
  const finalVideosFolder = finalVideosFolderIterator.next();
  
  // Locate template folder
  const templateFolderIterator = finalVideosFolder.getFoldersByName(templateName);
  if (!templateFolderIterator.hasNext()) {
    Logger.log(`Error: Template folder named ${templateName} not found inside Final_Videos.`);
    return;
  }
  const templateFolder = templateFolderIterator.next();
  Logger.log(`Processing files in source folder: ${templateFolder.getName()}`);

  // Locate Dealers folder
  const dealersFolderIterator = creativeAutomationFolder.getFoldersByName('Dealers');
  if (!dealersFolderIterator.hasNext()) {
    Logger.log('Error: "Dealers" folder not found inside "Creative Automation".');
    return;
  }
  const dealersFolder = dealersFolderIterator.next();

  // Process all video files
  const files = templateFolder.getFiles();
  let movedCount = 0;
  let skippedCount = 0;

  while (files.hasNext()) {
    const file = files.next();
    const currentName = file.getName();
    
    if (currentName.toLowerCase().endsWith(fileExtension)) {
      const dealerName = currentName.substring(0, currentName.lastIndexOf(fileExtension));
      const newFileName = `${templateName}_${dealerName}${fileExtension}`;
      
      const dealerFolderIterator = dealersFolder.getFoldersByName(dealerName);
      if (dealerFolderIterator.hasNext()) {
        const destinationFolder = dealerFolderIterator.next();
        
        try {
          file.setName(newFileName);
          file.moveTo(destinationFolder); 
          movedCount++;
          Logger.log(`Moved and renamed: ${newFileName} to ${destinationFolder.getName()}`);
        } catch (e) {
          Logger.log(`Could not process file ${currentName}. Error: ${e}`);
        }
      } else {
        Logger.log(`Skipped: Could not find destination dealer folder for: ${dealerName}`);
        skippedCount++;
      }
    } else {
       Logger.log(`Skipping non-video file: ${currentName}`);
       skippedCount++;
    }
  }

  Logger.log(`✅ Script Finished. Total videos moved and renamed: ${movedCount}. Files skipped: ${skippedCount}`);
}
```

**Result:** Each dealer folder contains their video named `Post ###_[Dealer Name].mp4`

---

## Step 7: Generate Post Copy

**File:** `C:\Users\GregWood\OneDrive - woodhouseagency.com\Woodhouse Business\Woodhouse_Agency\Clients\AAE\Turnkey Social Media\Dealer Database\Turnkey SM  -  FOR POSTING - BY REGION.xlsx`

**Tab:** Custom North (or applicable region)

**Formula Logic:**
```excel
=IF(ISNUMBER(SEARCH($C$1,$C12)),
     SUBSTITUTE($C12,$C$1,$C$1&" "&G$9),
     $C12 & " " & $C$1 & " " & G$9)
```

**Purpose:** Combines call-to-action text with dealer phone/website/company name

**Copy Options (Column C):**
- Call
- Call us
- Give us a call
- Visit
- Find out more
- Learn more
- Reach out
- Get in touch
- Give us a shout

**Output:** Generated post copy for each dealer to paste into Meta Business Manager

---

## Step 8: Schedule Posts in Meta Business Manager

**Tool:** Meta Business Manager Bulk Upload Reels Composer
**URL:** `https://business.facebook.com/latest/reels_bulk_upload_composer?asset_id=398228883856328`

**Identity:** communitymanagers@woodhouseagency.com

**Process:**
1. Community manager receives email with:
   - Link to scheduling spreadsheet (post copy)
   - Link to Creative Automation dealer folders (videos)
2. Open Meta Business Manager bulk upload tool
3. For each dealer:
   - Select dealer's Facebook page
   - Upload video from dealer folder
   - Paste post copy into description
   - Schedule posting (typically every 3 days)
4. Click Publish

**Time Required:** ~2-3 hours for 28 dealers

---

## Step 9: Send Dealer Notifications

**File:** Post Scheduled Email spreadsheet

**Identity:** communitymanagers@woodhouseagency.com

**Tool:** Mail Merge for Gmail 28.0.0 extension

**Process:**
1. Add all scheduled dealers to notification spreadsheet
2. Run Mail Merge extension
3. Bulk email dealers confirming their posts have been scheduled

---

## Summary: Current Pain Points

| Step | Pain Point | Time Impact |
|------|------------|-------------|
| 3 | Manual dealer data validation | High |
| 3 | Manual logo searching/modification | High |
| 4 | Manual CSV export | Low |
| 5 | Manual download/unzip/upload | Medium |
| 6 | Running Google Apps Script manually | Low |
| 7 | Formula-based copy generation | Medium |
| 8 | Manual Meta scheduling (CANNOT CHANGE) | High |

---

## File Locations Summary

| Purpose | Location |
|---------|----------|
| Base Videos | `G:\Shared drives\Woodhouse Social\Creative Automation\Base Videos` |
| Final Videos | `G:\Shared drives\Woodhouse Social\Creative Automation\Final_Videos\Post ###` |
| Dealer Folders | `G:\Shared drives\Woodhouse Social\Creative Automation\Dealers\[Name]` |
| Dealer Source of Truth | OneDrive: `Turnkey Social Media - Dealers - Current.xlsm` |
| Validated Import | OneDrive: `Import Creatomate Data Validated.xlsx` |
| Creatomate CSV | `C:\Users\gregwood\Downloads\Creatomate Import North Validated.csv` |
| Posting Spreadsheet | OneDrive: `Turnkey SM - FOR POSTING - BY REGION.xlsx` |

---

## Tools Used

- **Canva** - Base video template creation
- **Creatomate** - Dynamic video rendering with dealer data
- **Google Drive** - Video storage and organization
- **Google Apps Script** - File renaming and organization
- **Excel** - Data management and copy generation
- **Meta Business Manager** - Manual posting/scheduling
- **Mail Merge for Gmail** - Dealer notifications

---

*Document created: December 18, 2025*
*Next: Identify automation opportunities using Woodhouse Social infrastructure*
