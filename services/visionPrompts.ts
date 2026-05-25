export const VISION_EXTRACTION_PROMPT = `Analyze this PDF page or cropped region.

This is a review-markup document. It may contain a dashboard screenshot with handwritten notes, arrows, boxes, circles, underlines, highlights, and scribbled review comments.

Extract only reviewer-added content:
- handwritten comments
- handwritten labels
- arrows
- boxes
- circles
- underlines
- highlights
- marked UI areas
- comments written near arrows or boxes

Ignore normal dashboard/UI text unless it is directly connected to a handwritten note, arrow, box, highlight, or marked area.

Do not extract random UI labels as comments.

Return only strict JSON. Do not return markdown. Do not return explanation.

JSON format:
{
  "notes": [
    {
      "noteType": "handwritten_note | highlight | arrow | box | circle | underline | marked_area | scribble | unclear",
      "extractedText": "exact visible handwritten/reviewer text if readable",
      "summary": "short meaning of the note",
      "isMeaningfulReviewNote": true,
      "position": {
        "x": 0,
        "y": 0,
        "width": 0,
        "height": 0
      },
      "confidence": 0.0,
      "reason": "why this was classified as a review note"
    }
  ]
}

Rules:
- If text is unreadable, set extractedText as empty string and noteType as unclear.
- If it is only a random scribble with no useful meaning, set isMeaningfulReviewNote false.
- If it is a box around a UI area with no readable text, classify as marked_area.
- If there is an arrow pointing to a note, combine the arrow and note into one meaningful item.
- Do not create duplicate notes for the same handwritten text.
- Return coordinates relative to the image provided.`;

export const VISION_CROP_REFINEMENT_SUFFIX = `

This image is a CROPPED region from a PDF review page. Focus on reading handwritten text and classifying the markup in this crop only. Be precise with bounding boxes relative to THIS crop image (top-left origin).`;

export const VISION_STRICT_JSON_RETRY = `Your previous response was invalid. Return ONLY valid JSON matching the schema. No markdown, no commentary.`;
