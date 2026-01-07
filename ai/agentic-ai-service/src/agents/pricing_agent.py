# agents/pricing_agent.py
import numpy as np
from sklearn.linear_model import LinearRegression
from datetime import datetime

class PricingAgent:
    def __init__(self):
        self.db = DatabaseClient()
        
    async def calculate_optimal_price(self, service_id: str, 
                                     booking_time: datetime) -> Dict:
        """Calculate dynamic price for a service"""
        
        # Get base price
        base_price = await self.db.get_service_price(service_id)
        
        # Consider demand factors
        demand_factor = await self.calculate_demand_factor(service_id, booking_time)
        
        # Consider competitor pricing
        competitor_factor = await self.get_competitor_pricing(service_id)
        
        # Consider customer willingness to pay
        willingness_factor = await self.estimate_willingness_to_pay(service_id, booking_time)
        
        # Apply dynamic pricing formula
        optimal_price = base_price * demand_factor * competitor_factor * willingness_factor
        
        # Ensure within bounds
        min_price = base_price * 0.7
        max_price = base_price * 1.5
        
        final_price = max(min_price, min(optimal_price, max_price))
        
        return {
            "price": round(final_price, 2),
            "base_price": base_price,
            "demand_factor": demand_factor,
            "competitor_factor": competitor_factor,
            "willingness_factor": willingness_factor,
            "discount_percentage": round((1 - final_price/base_price) * 100, 1) if final_price < base_price else 0,
            "explanation": await self.explain_pricing(final_price, base_price, {
                "demand": demand_factor,
                "competition": competitor_factor,
                "willingness": willingness_factor
            })
        }
    
    async def calculate_demand_factor(self, service_id: str, 
                                     booking_time: datetime) -> float:
        """Calculate demand-based pricing factor"""
        
        # Get historical booking data
        historical = await self.db.get_service_demand(service_id, booking_time)
        
        # Time-based factors
        hour = booking_time.hour
        day = booking_time.weekday()
        month = booking_time.month
        
        # Peak hour multiplier
        if 17 <= hour <= 20 or 9 <= hour <= 11:  # Evening or morning peak
            time_factor = 1.2
        elif hour >= 21 or hour <= 6:  # Very early/late
            time_factor = 0.8
        else:
            time_factor = 1.0
        
        # Day of week multiplier
        if day >= 5:  # Weekend
            day_factor = 1.3
        else:
            day_factor = 1.0
        
        # Seasonal multiplier
        if month in [6, 7, 8]:  # Summer
            season_factor = 1.2
        elif month in [12, 1]:  # Holiday season
            season_factor = 1.3
        else:
            season_factor = 1.0
        
        # Current booking load
        current_load = await self.get_current_booking_load(service_id, booking_time)
        load_factor = 1 + (current_load * 0.1)  # 10% increase per 10% load
        
        # Combine factors
        demand_factor = time_factor * day_factor * season_factor * load_factor
        
        return min(demand_factor, 1.5)  # Cap at 50% increase