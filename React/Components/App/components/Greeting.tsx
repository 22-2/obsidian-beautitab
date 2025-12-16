import React from "react";
import getTimeOfDayGreeting from "React/Utils/getTimeOfDayGreeting";

interface GreetingProps {
	greetingText: string;
}

export const Greeting: React.FC<GreetingProps> = ({ greetingText }) => (
	<div className="beautitab-greeting">
		{greetingText.replace(/{{greeting}}/gi, getTimeOfDayGreeting())}
	</div>
);
