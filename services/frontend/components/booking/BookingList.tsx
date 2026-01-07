'use client';

// Update the interface to match the extended Booking type
interface Booking {
  id: string;
  serviceType: string;
  className: string;
  dateTime: string;
  status: string;
  userId?: string;
  participants?: number;
  notes?: string;
  createdAt?: string;
}

interface BookingListProps {
  bookings: Booking[];
}

export default function BookingList({ bookings }: BookingListProps) {
  if (bookings.length === 0) {
    return <p className="text-gray-500 text-center py-8">No bookings yet</p>;
  }

  return (
    <div className="space-y-4">
      {bookings.map((booking) => (
        <div key={booking.id} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-lg">{booking.className}</h3>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                  {booking.serviceType}
                </span>
                {booking.participants && (
                  <span className="text-sm text-blue-600">
                    👥 {booking.participants} {booking.participants === 1 ? 'person' : 'people'}
                  </span>
                )}
              </div>
            </div>
            <span className={`px-3 py-1 text-xs font-medium rounded-full ${
              booking.status === 'confirmed' 
                ? 'bg-green-100 text-green-800' 
                : booking.status === 'pending'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {booking.status}
            </span>
          </div>
          <p className="text-sm text-gray-700 mt-2">
            📅 {new Date(booking.dateTime).toLocaleDateString()} 
            <span className="mx-2">•</span>
            🕐 {new Date(booking.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          {booking.notes && (
            <p className="text-sm text-gray-600 mt-2 border-l-4 border-blue-200 pl-3 py-1">
              📝 <span className="italic">{booking.notes}</span>
            </p>
          )}
          {booking.createdAt && (
            <p className="text-xs text-gray-500 mt-2">
              Created: {new Date(booking.createdAt).toLocaleDateString()}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}