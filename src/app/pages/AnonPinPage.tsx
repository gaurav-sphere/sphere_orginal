import React, { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Shield, Check } from "lucide-react";
import { AppShell } from "../components/AppShell";

function PinDots({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col items-center gap-3" onClick={() => ref.current?.focus()}>
      <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">{label}</p>
      <div className="flex gap-4">
        {[0,1,2,3].map(i => (
          <div key={i} className={`w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${value[i]?"bg-blue-600 border-blue-600":"bg-gray-100 border-gray-300"}`}>
            {value[i] && <div className="w-3.5 h-3.5 rounded-full bg-white" />}
          </div>
        ))}
      </div>
      <input ref={ref} type="tel" inputMode="numeric" maxLength={4} value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g,"").slice(0,4))}
        className="w-1 h-1 opacity-0 absolute" />
    </div>
  );
}

export function AnonPinPage() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<1|2|3>(1);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const next = () => {
    if (step === 1) {
      if (current !== "1234") { setError("Incorrect current PIN"); return; }
      setError(""); setStep(2);
    } else if (step === 2) {
      if (newPin.length !== 4) { setError("PIN must be 4 digits"); return; }
      setError(""); setStep(3);
    } else {
      if (newPin !== confirm) { setError("PINs don't match"); return; }
      setSaved(true);
      setTimeout(() => navigate("/settings"), 1500);
    }
  };

  return (
    <AppShell>
      <div className="page-enter mt-14 lg:mt-0 min-h-screen bg-white">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 sticky top-14 lg:top-0 bg-white z-10">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <h1 className="font-bold text-gray-900">Change Anon PIN</h1>
        </div>
        <div className="flex flex-col items-center px-6 py-12 gap-8">
          <div className="w-16 h-16 rounded-2xl bg-gray-900 flex items-center justify-center">
            {saved ? <Check size={30} className="text-white" /> : <Shield size={28} className="text-white" />}
          </div>
          {saved ? (
            <div className="text-center">
              <p className="font-bold text-gray-900 text-lg">PIN Updated!</p>
              <p className="text-sm text-gray-500 mt-1">Your anon PIN has been changed successfully.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                {[1,2,3].map(s => (
                  <React.Fragment key={s}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= s ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"}`}>{s}</div>
                    {s < 3 && <div className={`w-8 h-0.5 rounded ${step > s ? "bg-blue-600" : "bg-gray-200"}`} />}
                  </React.Fragment>
                ))}
              </div>
              {step === 1 && <PinDots label="Enter current PIN" value={current} onChange={setCurrent} />}
              {step === 2 && <PinDots label="Enter new PIN" value={newPin} onChange={setNewPin} />}
              {step === 3 && <PinDots label="Confirm new PIN" value={confirm} onChange={setConfirm} />}
              {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
              <button onClick={next}
                className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all">
                {step === 3 ? "Save New PIN" : "Continue"}
              </button>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
