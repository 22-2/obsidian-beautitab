import React from "react";

interface TimeDisplayProps {
	time: string;
}

export const TimeDisplay: React.FC<TimeDisplayProps> = ({ time }) => (
	<div className="beautitab-time">{time}</div>
);
