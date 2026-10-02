import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { useEffect, useRef, useState } from 'react'
import { playScanTick } from '../lib/sound'

/**
 * Live camera scanner. Reads the three symbologies the bedside flow uses:
 *   DataMatrix (GS1 medicine packs), Code 128 (wristbands), QR (Indonesian KKJH Hajj health card).
 * Restricting formats makes decoding faster and avoids false reads.
 */

type CameraState = 'starting' | 'live' | 'denied' | 'unavailable' | 'insecure'

const hints = new Map<DecodeHintType, unknown>([
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.DATA_MATRIX, BarcodeFormat.CODE_128, BarcodeFormat.QR_CODE]],
  [DecodeHintType.TRY_HARDER, true],
])

const MESSAGES: Record<Exclude<CameraState, 'starting' | 'live'>, string> = {
  denied: 'لم يُسمح باستخدام الكاميرا. فعّليها من إعدادات المتصفح، أو استخدمي الإدخال اليدوي بالأسفل.',
  unavailable: 'لم نجد كاميرا في هذا الجهاز. استخدمي الإدخال اليدوي بالأسفل.',
  insecure: 'الكاميرا تحتاج رابطاً آمناً (https). استخدمي الإدخال اليدوي، أو افتحي النسخة المنشورة.',
}

export function Scanner({
  onResult,
  aspect = 'square',
  label,
}: {
  onResult: (text: string) => void
  aspect?: 'square' | 'wide'
  /** Live status shown under the viewfinder, only while the camera is reading. */
  label: string
}) {
  const video = useRef<HTMLVideoElement>(null)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult
  const [state, setState] = useState<CameraState>('starting')

  useEffect(() => {
    if (!window.isSecureContext) {
      setState('insecure')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unavailable')
      return
    }

    let controls: IScannerControls | undefined
    let done = false
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 })

    reader
      .decodeFromConstraints(
        { video: { facingMode: 'environment', width: { ideal: 1280 } } },
        video.current!,
        (result) => {
          if (!result || done) return
          done = true
          controls?.stop()
          playScanTick()
          onResultRef.current(result.getText())
        },
      )
      .then((c) => {
        controls = c
        if (done) c.stop()
        else setState('live')
      })
      .catch((err: DOMException) => {
        setState(err?.name === 'NotAllowedError' ? 'denied' : 'unavailable')
      })

    return () => {
      done = true
      controls?.stop()
    }
  }, [])

  const box = aspect === 'square' ? 'aspect-square w-[72%]' : 'aspect-[14/9] w-[80%]'

  return (
    <>
    <div className="relative flex w-full flex-1 items-center justify-center overflow-hidden rounded-lg bg-black/40">
      <video
        ref={video}
        className="absolute inset-0 h-full w-full object-cover"
        muted
        playsInline
        aria-label="معاينة الكاميرا"
      />
      <div className={`relative ${box}`} aria-hidden="true">
        {(['top-0 start-0 border-t-4 border-s-4 rounded-ss-md', 'top-0 end-0 border-t-4 border-e-4 rounded-se-md',
          'bottom-0 start-0 border-b-4 border-s-4 rounded-es-md', 'bottom-0 end-0 border-b-4 border-e-4 rounded-ee-md'] as const).map(
          (pos) => <span key={pos} className={`absolute h-8 w-8 border-[#4FA3E8] ${pos}`} />,
        )}
        {state === 'live' && (
          <span className="absolute inset-x-0 h-[3px] rounded bg-[#4FA3E8] shadow-[0_0_14px_2px_rgba(79,163,232,.8)] [animation:scanline_2.4s_ease-in-out_infinite]" />
        )}
      </div>

      {state !== 'live' && state !== 'starting' && (
        <p className="absolute inset-x-6 bottom-6 rounded-md bg-black/70 p-3 text-center text-[13px] leading-6 text-white">
          {MESSAGES[state]}
        </p>
      )}
    </div>
    {state === 'live' && <ScanStatus label={label} />}
    </>
  )
}

function ScanStatus({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-[#152A3D] px-3 py-1.5 text-[12px] font-medium text-[#4FA3E8]">
      <span className="h-2 w-2 rounded-full bg-[#4FA3E8] [animation:pulse-dot_1.2s_ease-in-out_infinite]" />
      {label}
    </span>
  )
}
