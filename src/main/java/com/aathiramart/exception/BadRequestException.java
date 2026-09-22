package com.aathiramart.exception;

/** 400 - bad client input / business rule violation. */
public class BadRequestException extends RuntimeException {

    public BadRequestException(String message) {
        super(message);
    }
}
