// HomeButton.js
import { useState } from "react";
import CreateSessionButton from "./CreateSessionButton";

const Share = () => {
  const [showCreateSession, setShowCreateSession] = useState(false);

  return (
    <div className=" h-screen flex items-center justify-center">
      {showCreateSession ? (
        <CreateSessionButton />
      ) : (
        <button
          onClick={() => setShowCreateSession(true)}
          className="p-4 bg-blue-600 rounded-xl text-white"
        >
          Start Collaborating
        </button>
      )}
    </div>
  );
};

export default Share;
