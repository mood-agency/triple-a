import { createReactBlockSpec } from "@blocknote/react";
import { Plus } from "lucide-react";
import { eventBus } from "@/events";
import { formatLocalDate } from "@/utils/dateUtils";
import "./HourDividerBlock.css";

// Special hour value for "All Day" section (must match noteBlockAdapter.ts)
const ALL_DAY_HOUR = -1;

/**
 * HourDividerBlock - A non-editable block that displays an hour separator in timeline view.
 *
 * This block:
 * - Shows the hour label (e.g., "09:00") or "All Day" for hour = -1
 * - Is not editable (content: "none")
 * - Can be clicked to create a new task at that hour
 * - Keyboard navigation skips over it naturally
 */
export const HourDividerBlock = createReactBlockSpec(
    {
        type: "hourDivider",
        propSchema: {
            hour: { default: 0 },
            isEmpty: { default: true },
        },
        content: "none", // Non-editable block
    },
    {
        render: (props) => {
            const hour = props.block.props.hour as number;
            const isEmpty = props.block.props.isEmpty as boolean;
            const isAllDay = hour === ALL_DAY_HOUR;
            const formattedHour = isAllDay ? 'All Day' : String(hour).padStart(2, '0') + ':00';

            const handleClick = () => {
                eventBus.emit('timeline:createTask', {
                    hour,
                    date: formatLocalDate(new Date()),
                });
            };

            return (
                <div
                    className={`hour-divider ${isEmpty ? 'hour-divider-empty' : ''} ${isAllDay ? 'hour-divider-all-day' : ''}`}
                    contentEditable={false}
                    style={{
                        outline: 'none',
                        border: 'none',
                        boxShadow: 'none',
                    }}
                    data-hour-divider="true"
                >
                    <div className="hour-divider-label">
                        {formattedHour}
                    </div>
                    {isEmpty && !isAllDay && (
                        <button
                            className="hour-divider-add-button"
                            onClick={handleClick}
                            title={`Add task at ${formattedHour}`}
                        >
                            <Plus size={14} />
                        </button>
                    )}
                </div>
            );
        },
    }
);
