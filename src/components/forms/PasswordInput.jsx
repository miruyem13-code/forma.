import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
export default function PasswordInput({ registration, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-input">
      <input
        type={visible ? "text" : "password"}
        {...registration}
        {...props}
      />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible(!visible)}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
