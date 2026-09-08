import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

export type ExtractionProgress = (message: string) => void

type PositionedWord = { text: string; x: number; y: number; width: number }

function pageRows(items: unknown[]) {
  const words: PositionedWord[] = items.flatMap((item) => {
    if (typeof item !== 'object' || !item || !('str' in item) || !('transform' in item)) return []
    const text = item.str
    const transform = item.transform
    if (typeof text !== 'string' || !text.trim() || !Array.isArray(transform)) return []
    const width = 'width' in item && typeof item.width === 'number' ? item.width : 0
    return [{ text, x: transform[4], y: transform[5], width }]
  })
  const rows: Array<{ y: number; words: PositionedWord[] }> = []
  for (const word of words.sort((left, right) => right.y - left.y || left.x - right.x)) {
    const row = rows.find((candidate) => Math.abs(candidate.y - word.y) <= 3)
    if (row) row.words.push(word)
    else rows.push({ y: word.y, words: [word] })
  }
  return rows
    .sort((left, right) => right.y - left.y)
    .map((row) => {
      const words = row.words.sort((left, right) => left.x - right.x)
      return words.reduce((line, word, index) => {
        if (!index) return word.text
        const previous = words[index - 1]
        const gap = word.x - (previous.x + previous.width)
        return `${line}${gap > 18 ? ' | ' : ' '}${word.text}`
      }, '')
    })
    .filter(Boolean)
    .join('\n')
}

export async function extractSyllabusText(file: File, onProgress: ExtractionProgress): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'pdf') return extractPdf(file, onProgress)
  if (extension === 'docx') return extractDocx(file, onProgress)
  if (['png', 'jpg', 'jpeg', 'heic'].includes(extension || '')) return extractImage(file, onProgress)
  throw new Error('That file type is not supported. Choose a PDF, DOCX, PNG, JPG, or HEIC file.')
}

async function extractPdf(file: File, onProgress: ExtractionProgress) {
  onProgress('Reading PDF text…')
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const pages: string[] = []
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    onProgress(`Reading PDF page ${pageNumber} of ${document.numPages}…`)
    const page = await document.getPage(pageNumber)
    const content = await page.getTextContent()
    pages.push(pageRows(content.items))
  }
  const text = pages.join('\n')
  if (!text.trim()) throw new Error('This PDF has no readable text. Try a text-based PDF, paste the syllabus text, or upload an image for OCR.')
  return text
}

async function extractDocx(file: File, onProgress: ExtractionProgress) {
  onProgress('Reading DOCX text…')
  const mammoth = (await import('mammoth')).default
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
  if (!result.value.trim()) throw new Error('This DOCX has no readable text. Try pasting the syllabus text instead.')
  return result.value
}

async function extractImage(file: File, onProgress: ExtractionProgress) {
  onProgress('Starting image OCR…')
  const { createWorker } = await import('tesseract.js')
  let source: File | Blob = file
  if (file.name.toLowerCase().endsWith('.heic')) {
    onProgress('Converting HEIC image…')
    const { default: heic2any } = await import('heic2any')
    const converted = await heic2any({ blob: file, toType: 'image/jpeg' })
    source = Array.isArray(converted) ? converted[0] : converted
  }
  const worker = await createWorker('eng', 1, { logger: (update) => { if (update.status === 'recognizing text') onProgress(`Reading image… ${Math.round((update.progress || 0) * 100)}%`) } })
  try {
    const result = await worker.recognize(source)
    if (!result.data.text.trim()) throw new Error('No text was detected in this image. Try a clearer image or paste the syllabus text.')
    return result.data.text
  } finally {
    await worker.terminate()
  }
}
