import { approvalResumeRegistration } from "./approval-resume-route.js";
import { chatCompletionsRegistration } from "./chat-completions-route.js";
import { conversationDeleteRegistration } from "./conversation-delete.js";
import { projectDeleteRegistration } from "./project-delete.js";

export const conversationApiRoutes = [
  approvalResumeRegistration,
  chatCompletionsRegistration,
  conversationDeleteRegistration,
  projectDeleteRegistration,
];
