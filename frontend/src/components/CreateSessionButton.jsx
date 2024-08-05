// CreateSessionButton.js
import { useState } from "react";

const CreateSessionButton = () => {
  const [sessionUrl, setSessionUrl] = useState("");

  const createSession = async () => {
    try {
      console.log("helo");
      const response = await fetch("http://localhost:3000/create-session", {
        method: "POST",
      });
      const data = await response.json();
      setSessionUrl(`${window.location.origin}/session/${data.sessionId}`);
    } catch (error) {
      console.error("Failed to create session:", error);
    }
  };

  return (
    <div className="flex items-center flex-col bg-slate-100 p-10 rounded-xl shadow-lg">
      <button
        onClick={createSession}
        className="p-4 bg-blue-600 rounded-xl text-white m-5 "
      >
        Create New Session
      </button>
      {sessionUrl && (
        <div className="flex items-center flex-col">
          <p className="text-lg font-semibold py-3">
            Share this URL to collaborate:
          </p>
          <pre className="bg-[#f4f4f4] rounded-xl hover:cursor-pointer">
            <code>
              <a href={sessionUrl} rel="noopener noreferrer">
                {sessionUrl}
              </a>
            </code>
          </pre>
          {/* <CanvasDrawing sessionId={sessionUrl.split("/").pop()} /> */}
        </div>
      )}
    </div>
  );
};

export default CreateSessionButton;
