-- Admin access by password: a time-limited session per user.
ALTER TABLE "User" ADD COLUMN "adminUntil" TIMESTAMP(3);
