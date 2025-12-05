"use client";

import { useState, useEffect } from "react";

export default function ClientClock() {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    // Set initial time
    setTime(new Date());

    // Update time every second
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!time) {
    return (
      <div className="text-sm text-gray-600">
        Loading...
      </div>
    );
  }

  return (
    <div className="text-sm text-gray-600">
      {time.toLocaleTimeString()}
    </div>
  );
}