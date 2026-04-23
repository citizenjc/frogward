# Architecture

Initial target shape:

1. Browser automation logs into SAPO webmail
2. Inbox polling identifies unread or unseen messages
3. A local state store tracks processed message IDs
4. Matching messages are forwarded to a destination inbox
5. Logging and retry behavior keep the service observable

Implementation details are intentionally undecided at scaffold time.
