-- TRUNCATE ... RESTART IDENTITY and sequence resets go back to START, so START must be 1001 too.
ALTER SEQUENCE "Order_number_seq" START WITH 1001;
