import { act, renderHook } from '@testing-library/react-native';
import { useSelectedDay } from '../../hooks/useSelectedDay';

describe('useSelectedDay', () => {
    // Use a fixed date for consistent testing: Sunday, Jan 19, 2025
    const testDate = new Date(2025, 0, 19); // Month is 0-indexed

    it('initializes with today selected', () => {
        const { result } = renderHook(() => useSelectedDay(testDate));

        expect(result.current.selectedDay.dayIndex).toBe(0); // Sunday
        expect(result.current.selectedDay.isToday).toBe(true);
    });

    it('returns all 7 weekdays', () => {
        const { result } = renderHook(() => useSelectedDay(testDate));

        expect(result.current.weekDays).toHaveLength(7);
        expect(result.current.weekDays.map((d) => d.label)).toEqual([
            'Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa',
        ]);
    });

    it('formats date correctly', () => {
        const { result } = renderHook(() => useSelectedDay(testDate));

        expect(result.current.formattedDate).toBe('Sunday, January 19th');
    });

    it('allows selecting a different day', () => {
        const { result } = renderHook(() => useSelectedDay(testDate));

        act(() => {
            result.current.selectDay(1); // Monday
        });

        expect(result.current.selectedDay.dayIndex).toBe(1);
        expect(result.current.formattedDate).toBe('Monday, January 20th');
    });

    it('ignores invalid day indices', () => {
        const { result } = renderHook(() => useSelectedDay(testDate));

        act(() => {
            result.current.selectDay(10); // Invalid
        });

        expect(result.current.selectedDay.dayIndex).toBe(0); // Still Sunday

        act(() => {
            result.current.selectDay(-1); // Invalid
        });

        expect(result.current.selectedDay.dayIndex).toBe(0); // Still Sunday
    });

    it('marks only the current day as isToday', () => {
        const { result } = renderHook(() => useSelectedDay(testDate));

        const todayDays = result.current.weekDays.filter((d) => d.isToday);
        expect(todayDays).toHaveLength(1);
        expect(todayDays[0].dayIndex).toBe(0); // Sunday
    });

    it('handles ordinal suffixes correctly', () => {
        // Test 1st (1st)
        const jan1 = new Date(2025, 0, 1); // Wednesday
        const { result: result1 } = renderHook(() => useSelectedDay(jan1));
        expect(result1.current.formattedDate).toBe('Wednesday, January 1st');

        // Test 2nd
        const jan2 = new Date(2025, 0, 2); // Thursday
        const { result: result2 } = renderHook(() => useSelectedDay(jan2));
        expect(result2.current.formattedDate).toBe('Thursday, January 2nd');

        // Test 3rd
        const jan3 = new Date(2025, 0, 3); // Friday
        const { result: result3 } = renderHook(() => useSelectedDay(jan3));
        expect(result3.current.formattedDate).toBe('Friday, January 3rd');

        // Test 11th (special case)
        const jan11 = new Date(2025, 0, 11); // Saturday
        const { result: result11 } = renderHook(() => useSelectedDay(jan11));
        expect(result11.current.formattedDate).toBe('Saturday, January 11th');

        // Test 21st
        const jan21 = new Date(2025, 0, 21); // Tuesday
        const { result: result21 } = renderHook(() => useSelectedDay(jan21));
        expect(result21.current.formattedDate).toBe('Tuesday, January 21st');
    });
});
