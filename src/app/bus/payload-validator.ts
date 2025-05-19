import {
  BUS_NAMESPACE,
  BUS_EVENT_TYPE,
  type BusEventTypeValue,
  type InitConfigEvent,
  type InitCompleteEvent,
  type DomainEventWrapper,
  type FinishSummaryEvent,
  type FinishAbortEvent,
  type EventTypeToPayloadMap
} from './types.js';

function validateInitPayload(
  eventType: BusEventTypeValue,
  payload: InitConfigEvent | InitCompleteEvent
): void {
  if (eventType === BUS_EVENT_TYPE.INIT_CONFIG) {
    const typedPayload = payload as InitConfigEvent;
    if (typeof typedPayload.config === 'undefined') {
      throw new Error(`Invalid payload for ${eventType}: config is required`);
    }
  }
  // INIT_COMPLETE has no specific required fields other than what BusEventBase might require
}

function validateDomainPayload(
  eventType: BusEventTypeValue,
  payload: DomainEventWrapper
): void {
  if (typeof payload.event === 'undefined' || typeof payload.event.type === 'undefined') {
    throw new Error(
      `Invalid payload for ${eventType}: event with type is required`
    );
  }
}

function validateFinishPayload(
  eventType: BusEventTypeValue,
  payload: FinishSummaryEvent | FinishAbortEvent
): void {
  if (eventType === BUS_EVENT_TYPE.FINISH_SUMMARY) {
    const typedPayload = payload as FinishSummaryEvent;
    if (typeof typedPayload.stats === 'undefined') {
      throw new Error(`Invalid payload for ${eventType}: stats is required`);
    }
  } else if (eventType === BUS_EVENT_TYPE.FINISH_ABORT) {
    const typedPayload = payload as FinishAbortEvent;
    if (typeof typedPayload.reason === 'undefined' || typedPayload.reason === '') {
      throw new Error(`Invalid payload for ${eventType}: reason is required`);
    }
  }
}

export function validatePayload<T extends BusEventTypeValue>(
  eventType: T,
  payload: EventTypeToPayloadMap[T]
): void {
  if (typeof payload === 'undefined') {
    throw new Error(
      `Invalid payload for event ${eventType}: payload is required`
  );
  }
  if (eventType.startsWith(BUS_NAMESPACE.INIT)) {
    validateInitPayload(
      eventType,
      payload as InitConfigEvent | InitCompleteEvent
    );
  } else if (eventType.startsWith(BUS_NAMESPACE.DOMAIN)) {
    validateDomainPayload(eventType, payload as DomainEventWrapper);
  } else if (eventType.startsWith(BUS_NAMESPACE.FINISH)) {
    validateFinishPayload(
      eventType,
      payload as FinishSummaryEvent | FinishAbortEvent
    );
  }
}
