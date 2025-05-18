import {
  BusNamespace,
  BusEventType,
  type BusEventTypeValue,
  type InitConfigEvent,
  type InitCompleteEvent,
  type DomainEventWrapper,
  type FinishSummaryEvent,
  type FinishAbortEvent,
  type EventTypeToPayloadMap
} from './types.js';

function _validateInitPayload(
  eventType: BusEventTypeValue,
  payload: InitConfigEvent | InitCompleteEvent
): void {
  if (eventType === BusEventType.INIT_CONFIG) {
    const typedPayload = payload as InitConfigEvent;
    if (!typedPayload.config) {
      throw new Error(`Invalid payload for ${eventType}: config is required`);
    }
  }
  // INIT_COMPLETE has no specific required fields other than what BusEventBase might require
}

function _validateDomainPayload(
  eventType: BusEventTypeValue,
  payload: DomainEventWrapper
): void {
  if (!payload.event || !payload.event.type) {
    throw new Error(
      `Invalid payload for ${eventType}: event with type is required`
    );
  }
}

function _validateFinishPayload(
  eventType: BusEventTypeValue,
  payload: FinishSummaryEvent | FinishAbortEvent
): void {
  if (eventType === BusEventType.FINISH_SUMMARY) {
    const typedPayload = payload as FinishSummaryEvent;
    if (!typedPayload.stats) {
      throw new Error(`Invalid payload for ${eventType}: stats is required`);
    }
  } else if (eventType === BusEventType.FINISH_ABORT) {
    const typedPayload = payload as FinishAbortEvent;
    if (!typedPayload.reason) {
      throw new Error(`Invalid payload for ${eventType}: reason is required`);
    }
  }
}

export function validatePayload<T extends BusEventTypeValue>(
  eventType: T,
  payload: EventTypeToPayloadMap[T]
): void {
  if (!payload) {
    throw new Error(
      `Invalid payload for event ${eventType}: payload is required`
    );
  }
  if (eventType.startsWith(BusNamespace.INIT)) {
    _validateInitPayload(
      eventType,
      payload as InitConfigEvent | InitCompleteEvent
    );
  } else if (eventType.startsWith(BusNamespace.DOMAIN)) {
    _validateDomainPayload(eventType, payload as DomainEventWrapper);
  } else if (eventType.startsWith(BusNamespace.FINISH)) {
    _validateFinishPayload(
      eventType,
      payload as FinishSummaryEvent | FinishAbortEvent
    );
  }
}
