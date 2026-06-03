import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export function Barcode({
  value,
  height = 70,
  className = "",
}: {
  value: string;
  height?: number;
  className?: string;
}) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    // Boleto-style: digits only, ITF (Interleaved 2 of 5), must be even length
    let digits = value.replace(/\D/g, "");
    if (digits.length === 0) digits = "0";
    if (digits.length % 2 !== 0) digits = "0" + digits;
    try {
      JsBarcode(ref.current, digits, {
        format: "ITF",
        height,
        width: 1.6,
        displayValue: false,
        margin: 0,
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch {
      // fallback to CODE128 if ITF rejects
      try {
        JsBarcode(ref.current, digits, {
          format: "CODE128",
          height,
          width: 1.4,
          displayValue: false,
          margin: 0,
        });
      } catch {
        /* noop */
      }
    }
  }, [value, height]);

  return <svg ref={ref} className={className} />;
}
