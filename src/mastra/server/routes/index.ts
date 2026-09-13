import { approvalResumeRegistration } from "./approval-resume.js";
import { chatCompletionsRegistration } from "./chat-completions.js";
import { conversationDeleteRegistration } from "./conversation-delete.js";
import { projectDeleteRegistration } from "./project-delete.js";

export const conversationApiRoutes = [
  approvalResumeRegistration,
  chatCompletionsRegistration,
  conversationDeleteRegistration,
  projectDeleteRegistration,
];
