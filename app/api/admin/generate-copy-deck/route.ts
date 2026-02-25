/**
 * GET /api/admin/generate-copy-deck?startPost={number}&endPost={number}
 *
 * Generates a PDF "Copy Deck" for content dealers containing:
 * - Cover page with vertical logo and title
 * - Video thumbnails from Cloudinary
 * - Post numbers and copy (with smart emoji/variable replacement)
 *
 * Brand styling: Woodhouse Blue (#12ace2)
 *
 * Note: Content dealer videos are stored in Cloudinary (named "Post 667").
 * FULL dealer videos remain in Google Drive (named "Post 667 C").
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { fetchCloudinaryThumbnail } from '@/lib/cloudinary';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import path from 'path';
import fs from 'fs';

// Brand colors from BRAND_GUIDELINES (converted to 0-1 range)
const COLORS = {
  primaryBlue: rgb(0.07, 0.67, 0.89),    // #12ace2
  deepBlue: rgb(0.12, 0.47, 0.67),       // #1e78ab
  black: rgb(0, 0, 0),
  white: rgb(1, 1, 1),
  darkGray: rgb(0.29, 0.30, 0.29),       // #4a4d4b
  lightGray: rgb(0.93, 0.93, 0.93),      // #eeecec
};

// Cloudinary handles video storage and thumbnail generation
// See lib/cloudinary.ts for implementation details

/**
 * Smart emoji replacement - replaces emojis with contextual text instead of just stripping
 */
function replaceEmojis(text: string): string {
  // Phone emojis - context-aware replacement
  // Pattern: "Give us a 📞" -> "Give us a call"
  text = text.replace(/give us a\s*[\u{1F4DE}\u{1F4F1}\u{260E}]/giu, 'give us a call');
  text = text.replace(/Give us a\s*[\u{1F4DE}\u{1F4F1}\u{260E}]/giu, 'Give us a call');

  // Phone emoji after punctuation - new sentence, capital G
  // Pattern: "Need one? 📞" -> "Need one? Give us a call."
  text = text.replace(/([.!?])\s*[\u{1F4DE}\u{1F4F1}\u{260E}]\s*/gu, '$1 Give us a call. ');

  // Phone emoji at end after word (no punctuation before) - add period and new sentence
  text = text.replace(/([a-zA-Z])\s*[\u{1F4DE}\u{1F4F1}\u{260E}]\s*$/gu, '$1. Give us a call.');

  // Remove decorative emojis that don't need replacement
  const decorativeEmojis = /[\u{2705}\u{27A1}\u{FE0F}\u{1F525}\u{2744}\u{FE0F}\u{1F4A8}\u{2600}\u{FE0F}\u{1F31E}\u{1F321}\u{FE0F}\u{1F3E0}\u{1F4AA}\u{2728}\u{1F389}\u{1F44D}\u{1F64C}\u{1F60A}\u{1F642}]/gu;
  text = text.replace(decorativeEmojis, '');

  return text;
}

/**
 * Replace template variables with generic alternatives for content dealers
 */
function replaceTemplateVariables(text: string): string {
  // Replace {phone} with "give us a call" or contextual phrase (lowercase, sentence will be fixed later)
  text = text.replace(/give us a\s*\{phone\}/gi, 'give us a call');
  text = text.replace(/Give us a\s*\{phone\}/gi, 'Give us a call');
  text = text.replace(/call us at\s*\{phone\}/gi, 'give us a call');
  text = text.replace(/Call us at\s*\{phone\}/gi, 'Give us a call');

  // Standalone {phone} after punctuation - new sentence
  text = text.replace(/([.!?])\s*\{phone\}/gi, '$1 Give us a call.');

  // Remove remaining {phone} references
  text = text.replace(/\{phone\}/gi, '');

  // Replace {dealer_name} with generic
  text = text.replace(/\{dealer_name\}/gi, 'your local dealer');
  text = text.replace(/\{name\}/gi, 'your local dealer');

  // Remove address and website references entirely
  text = text.replace(/at\s*\{address\}/gi, '');
  text = text.replace(/\{address\}/gi, '');
  text = text.replace(/visit\s*\{website\}/gi, '');
  text = text.replace(/\{website\}/gi, '');

  // Clean up any remaining template variables
  text = text.replace(/\{[^}]+\}/g, '');

  return text;
}

/**
 * Sanitize text for PDF - handle encoding and clean up
 */
function sanitizeForPdf(text: string): string {
  // First, do smart replacements
  text = replaceEmojis(text);
  text = replaceTemplateVariables(text);

  // Then strip any remaining non-WinAnsi characters
  text = text
    .split('')
    .map(char => {
      const code = char.charCodeAt(0);
      // Keep standard ASCII printable chars and extended Latin
      if ((code >= 0x20 && code <= 0x7E) || (code >= 0xA0 && code <= 0xFF)) {
        return char;
      }
      // Replace other special chars with space
      return ' ';
    })
    .join('');

  // Clean up whitespace and fix grammar issues
  text = text
    .replace(/\s+/g, ' ')           // Collapse multiple spaces
    .replace(/\s+([.,!?])/g, '$1')  // Remove space before punctuation
    .replace(/([.,!?])\s*\1+/g, '$1') // Remove duplicate punctuation
    .replace(/\s*\.\s*\./g, '.')    // Fix double periods
    .trim();

  // Fix incomplete sentences (e.g., "Give us a" at end)
  if (text.match(/give us a\s*$/i)) {
    text = text.replace(/give us a\s*$/i, 'Give us a call.');
  }

  // Ensure proper capitalization after sentence-ending punctuation
  text = text.replace(/([.!?])\s+([a-z])/g, (match, punct, letter) => {
    return punct + ' ' + letter.toUpperCase();
  });

  return text;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startPost = parseInt(searchParams.get('startPost') || '0');
    const endPost = parseInt(searchParams.get('endPost') || '0');

    if (!startPost || !endPost || startPost > endPost) {
      return NextResponse.json(
        { error: 'Invalid post range. Provide startPost and endPost where startPost <= endPost' },
        { status: 400 }
      );
    }

    if (endPost - startPost > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 posts per PDF to prevent timeout' },
        { status: 400 }
      );
    }

    // Fetch posts from Firestore
    const postsSnapshot = await db.collection('posts').get();
    const allPosts = postsSnapshot.docs.map(doc => ({
      postNumber: parseInt(doc.id),
      baseCopy: doc.data().baseCopy || '',
      templateId: doc.data().templateId || '',
    }));

    // Filter to requested range
    const posts = allPosts
      .filter(p => p.postNumber >= startPost && p.postNumber <= endPost)
      .sort((a, b) => a.postNumber - b.postNumber);

    if (posts.length === 0) {
      return NextResponse.json(
        { error: `No posts found in range ${startPost}-${endPost}` },
        { status: 404 }
      );
    }

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Load logos
    const verticalLogoPath = path.join(process.cwd(), 'public', 'Logo', 'WOODHOUSE LOGO VERTICAL.png');
    const horizontalLogoPath = path.join(process.cwd(), 'public', 'Logo', 'WOODHOUSE LOGO HORIZONTAL.png');

    let verticalLogo = null;
    let horizontalLogo = null;

    if (fs.existsSync(verticalLogoPath)) {
      const logoBuffer = fs.readFileSync(verticalLogoPath);
      verticalLogo = await pdfDoc.embedPng(logoBuffer);
    }
    if (fs.existsSync(horizontalLogoPath)) {
      const logoBuffer = fs.readFileSync(horizontalLogoPath);
      horizontalLogo = await pdfDoc.embedPng(logoBuffer);
    }

    // Page dimensions (Letter size)
    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 50;

    // Format date for footer
    const generatedDate = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    // ============================================
    // COVER PAGE
    // ============================================
    const coverPage = pdfDoc.addPage([pageWidth, pageHeight]);

    // Vertical logo - centered, moderate size
    if (verticalLogo) {
      const logoScale = 0.25; // Moderate size
      const logoWidth = verticalLogo.width * logoScale;
      const logoHeight = verticalLogo.height * logoScale;
      coverPage.drawImage(verticalLogo, {
        x: (pageWidth - logoWidth) / 2,
        y: pageHeight - 250,
        width: logoWidth,
        height: logoHeight,
      });
    }

    // Title: "TURNKEY SOCIAL MEDIA" - centered, dark gray
    const title = 'TURNKEY SOCIAL MEDIA';
    const titleWidth = helveticaBold.widthOfTextAtSize(title, 28);
    coverPage.drawText(title, {
      x: (pageWidth - titleWidth) / 2,
      y: pageHeight - 380,
      size: 28,
      font: helveticaBold,
      color: COLORS.darkGray,
    });

    // Subtitle: Post range - centered, gray
    const subtitle = `Posts ${startPost}-${endPost}`;
    const subtitleWidth = helvetica.widthOfTextAtSize(subtitle, 16);
    coverPage.drawText(subtitle, {
      x: (pageWidth - subtitleWidth) / 2,
      y: pageHeight - 410,
      size: 16,
      font: helvetica,
      color: COLORS.darkGray,
    });

    // Footer: Generated date - centered at bottom
    const footerText = `Generated ${generatedDate}`;
    const footerWidth = helvetica.widthOfTextAtSize(footerText, 10);
    coverPage.drawText(footerText, {
      x: (pageWidth - footerWidth) / 2,
      y: 40,
      size: 10,
      font: helvetica,
      color: COLORS.darkGray,
    });

    // ============================================
    // CONTENT PAGES
    // ============================================
    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let yPosition = pageHeight - margin;

    // Add compact header on first content page
    const headerHeight = 45;

    // Small horizontal logo - top left
    if (horizontalLogo) {
      const logoScale = 0.08; // Small
      const logoWidth = horizontalLogo.width * logoScale;
      const logoHeight = horizontalLogo.height * logoScale;
      page.drawImage(horizontalLogo, {
        x: margin,
        y: yPosition - logoHeight + 5,
        width: logoWidth,
        height: logoHeight,
      });
    }

    // "Content Copy Deck" title - next to logo
    page.drawText('Content Copy Deck', {
      x: margin + 120,
      y: yPosition - 12,
      size: 18,
      font: helveticaBold,
      color: COLORS.primaryBlue,
    });

    // Post range below title
    page.drawText(`Posts ${startPost}-${endPost}`, {
      x: margin + 120,
      y: yPosition - 28,
      size: 10,
      font: helvetica,
      color: COLORS.darkGray,
    });

    // Header separator line
    yPosition -= headerHeight;
    page.drawLine({
      start: { x: margin, y: yPosition },
      end: { x: pageWidth - margin, y: yPosition },
      thickness: 1,
      color: COLORS.lightGray,
    });
    yPosition -= 35; // More padding before first post

    // Process each post
    for (const post of posts) {
      // Check if we need a new page (each post needs ~140px)
      if (yPosition < 180) {
        // Add footer to current page
        page.drawText(footerText, {
          x: pageWidth - margin - helvetica.widthOfTextAtSize(footerText, 10),
          y: 30,
          size: 10,
          font: helvetica,
          color: COLORS.darkGray,
        });

        page = pdfDoc.addPage([pageWidth, pageHeight]);
        yPosition = pageHeight - margin;

        // Add compact header on new page
        if (horizontalLogo) {
          const logoScale = 0.08;
          const logoWidth = horizontalLogo.width * logoScale;
          const logoHeight = horizontalLogo.height * logoScale;
          page.drawImage(horizontalLogo, {
            x: margin,
            y: yPosition - logoHeight + 5,
            width: logoWidth,
            height: logoHeight,
          });
        }

        page.drawText('Content Copy Deck', {
          x: margin + 120,
          y: yPosition - 12,
          size: 18,
          font: helveticaBold,
          color: COLORS.primaryBlue,
        });

        page.drawText(`Posts ${startPost}-${endPost}`, {
          x: margin + 120,
          y: yPosition - 28,
          size: 10,
          font: helvetica,
          color: COLORS.darkGray,
        });

        yPosition -= headerHeight;
        page.drawLine({
          start: { x: margin, y: yPosition },
          end: { x: pageWidth - margin, y: yPosition },
          thickness: 1,
          color: COLORS.lightGray,
        });
        yPosition -= 35; // More padding before first post
      }

      // Get video thumbnail from Cloudinary
      let thumbnailImage = null;
      const thumbnailBuffer = await fetchCloudinaryThumbnail(post.postNumber);
      if (thumbnailBuffer) {
        try {
          thumbnailImage = await pdfDoc.embedJpg(thumbnailBuffer);
        } catch {
          try {
            thumbnailImage = await pdfDoc.embedPng(thumbnailBuffer);
          } catch {
            console.log(`[generate-copy-deck] Could not embed thumbnail for post ${post.postNumber}`);
          }
        }
      }

      // Thumbnail area (9:16 aspect ratio: 67.5w x 120h)
      const thumbWidth = 67.5;
      const thumbHeight = 120;
      const thumbX = margin;
      const thumbY = yPosition - thumbHeight;

      if (thumbnailImage) {
        page.drawImage(thumbnailImage, {
          x: thumbX,
          y: thumbY,
          width: thumbWidth,
          height: thumbHeight,
        });
      } else {
        // Draw placeholder
        page.drawRectangle({
          x: thumbX,
          y: thumbY,
          width: thumbWidth,
          height: thumbHeight,
          color: COLORS.lightGray,
        });
        page.drawText('No', {
          x: thumbX + 20,
          y: thumbY + 65,
          size: 10,
          font: helvetica,
          color: COLORS.darkGray,
        });
        page.drawText('Preview', {
          x: thumbX + 12,
          y: thumbY + 52,
          size: 10,
          font: helvetica,
          color: COLORS.darkGray,
        });
      }

      // Post number - Woodhouse Blue, bold
      const textStartX = margin + thumbWidth + 15;
      page.drawText(`Post ${post.postNumber}`, {
        x: textStartX,
        y: yPosition - 15,
        size: 16,
        font: helveticaBold,
        color: COLORS.primaryBlue,
      });

      // Post copy (wrap text, sanitize with smart replacement)
      const maxTextWidth = pageWidth - textStartX - margin;
      const sanitizedCopy = sanitizeForPdf(post.baseCopy || '(No copy available)');
      const copyLines = wrapText(sanitizedCopy, maxTextWidth, helvetica, 11);
      let copyY = yPosition - 35;

      for (const line of copyLines.slice(0, 6)) { // Max 6 lines to fit in space
        page.drawText(line, {
          x: textStartX,
          y: copyY,
          size: 11,
          font: helvetica,
          color: COLORS.black,
        });
        copyY -= 14;
      }
      if (copyLines.length > 6) {
        page.drawText('...', {
          x: textStartX,
          y: copyY,
          size: 11,
          font: helvetica,
          color: COLORS.darkGray,
        });
      }

      // Draw separator line
      yPosition -= thumbHeight + 15;
      page.drawLine({
        start: { x: margin, y: yPosition },
        end: { x: pageWidth - margin, y: yPosition },
        thickness: 1,
        color: COLORS.lightGray,
      });
      yPosition -= 15;
    }

    // Add footer on last page
    page.drawText(footerText, {
      x: pageWidth - margin - helvetica.widthOfTextAtSize(footerText, 10),
      y: 30,
      size: 10,
      font: helvetica,
      color: COLORS.darkGray,
    });

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save();

    // Return PDF
    const filename = `Turnkey_SM_Copy_Deck_Posts_${startPost}-${endPost}.pdf`;

    // Convert to Buffer for NextResponse compatibility
    const pdfBuffer = Buffer.from(pdfBytes);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });

  } catch (error: unknown) {
    console.error('[generate-copy-deck] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}

// Helper function to wrap text
function wrapText(text: string, maxWidth: number, font: { widthOfTextAtSize: (text: string, size: number) => number }, fontSize: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}
