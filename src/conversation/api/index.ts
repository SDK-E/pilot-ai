import { chatCompletionsRegistration } from "./chat-completions";
import { conversationDeleteRegistration } from "./conversation-delete";
import { generateRegistration } from "./generate";

export const conversationApiRoutes = [
  chatCompletionsRegistration,
  conversationDeleteRegistration,
  generateRegistration,
];
