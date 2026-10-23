<?php

use App\Enums\LeaveType;
use App\Enums\RequestStatus;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 14:39:00'));

    $this->mentor = User::factory()->mentor()->create();
    $this->andi = calendarIntern($this->mentor, 'Andi Pratama');
    $this->dewi = calendarIntern($this->mentor, 'Dewi Sartika');
});

function calendarIntern(User $mentor, string $name): User
{
    return User::factory()->intern([
        'mentor_id' => $mentor->id,
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
    ])->create(['name' => $name]);
}

function leaveCalendar(User $user, string $query = ''): TestResponse
{
    return test()->getJson('/api/mentor/leave-calendar'.$query, ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken]);
}

it('builds the current month with weekdays, today, and off days', function () {
    Holiday::factory()->create(['date' => '2026-10-20', 'name' => 'Libur Nasional']);

    $days = collect(leaveCalendar($this->mentor)->assertOk()->assertJsonPath('data.month', '2026-10')->json('data.days'))->keyBy('date');

    expect($days)->toHaveCount(31)
        ->and($days['2026-10-01'])->toBe(['date' => '2026-10-01', 'weekday' => 4, 'is_today' => false, 'is_off' => false, 'holiday_name' => null, 'entries' => []])
        ->and($days['2026-10-12']['is_today'])->toBeTrue()
        ->and($days['2026-10-10']['is_off'])->toBeTrue()
        ->and($days['2026-10-10']['holiday_name'])->toBeNull()
        ->and($days['2026-10-20']['is_off'])->toBeTrue()
        ->and($days['2026-10-20']['holiday_name'])->toBe('Libur Nasional');
});

it('shows pending and approved leaves on working days only', function () {
    $approved = LeaveRequest::factory()->for($this->andi, 'intern')->approved()->create([
        'type' => LeaveType::Sick, 'start_date' => '2026-10-09', 'end_date' => '2026-10-12',
    ]);
    $pending = LeaveRequest::factory()->for($this->dewi, 'intern')->create([
        'type' => LeaveType::Urgent, 'start_date' => '2026-10-12', 'end_date' => '2026-10-12',
    ]);
    LeaveRequest::factory()->for($this->dewi, 'intern')->create(['status' => RequestStatus::Rejected, 'start_date' => '2026-10-13', 'end_date' => '2026-10-13']);
    LeaveRequest::factory()->for($this->dewi, 'intern')->create(['status' => RequestStatus::Cancelled, 'start_date' => '2026-10-14', 'end_date' => '2026-10-14']);
    LeaveRequest::factory()->for(User::factory()->intern()->create(), 'intern')->create(['start_date' => '2026-10-12', 'end_date' => '2026-10-12']);

    $response = leaveCalendar($this->mentor, '?month=2026-10')->assertOk();
    $days = collect($response->json('data.days'))->keyBy('date');

    expect($days['2026-10-09']['entries'])->toBe([
        ['leave_id' => $approved->id, 'intern_id' => $this->andi->id, 'short_name' => 'Andi P.', 'type' => 'sick', 'status' => 'approved'],
    ])
        ->and($days['2026-10-10']['entries'])->toBe([])
        ->and($days['2026-10-11']['entries'])->toBe([])
        ->and(collect($days['2026-10-12']['entries'])->pluck('leave_id')->all())->toBe([$approved->id, $pending->id])
        ->and($days['2026-10-12']['entries'][1]['status'])->toBe('pending')
        ->and($days['2026-10-13']['entries'])->toBe([])
        ->and($days['2026-10-14']['entries'])->toBe([]);

    $response->assertJsonCount(2, 'data.leaves')
        ->assertJsonPath('data.leaves.0', [
            'id' => $approved->id,
            'intern' => ['id' => $this->andi->id, 'name' => 'Andi Pratama', 'short_name' => 'Andi P.'],
            'type' => 'sick',
            'start_date' => '2026-10-09',
            'end_date' => '2026-10-12',
            'status' => 'approved',
        ]);
});

it('includes leaves that cross the month boundary', function () {
    LeaveRequest::factory()->for($this->andi, 'intern')->approved()->create(['start_date' => '2026-10-29', 'end_date' => '2026-11-03']);

    $days = collect(leaveCalendar($this->mentor, '?month=2026-11')->assertOk()->assertJsonCount(1, 'data.leaves')->json('data.days'))->keyBy('date');

    expect($days['2026-11-02']['entries'])->toHaveCount(1)
        ->and($days['2026-11-04']['entries'])->toBe([]);
});

it('filters by intern', function () {
    LeaveRequest::factory()->for($this->andi, 'intern')->create(['start_date' => '2026-10-13', 'end_date' => '2026-10-13']);
    LeaveRequest::factory()->for($this->dewi, 'intern')->create(['start_date' => '2026-10-13', 'end_date' => '2026-10-13']);

    leaveCalendar($this->mentor, "?intern_id={$this->dewi->id}")
        ->assertOk()
        ->assertJsonCount(1, 'data.leaves')
        ->assertJsonPath('data.leaves.0.intern.id', $this->dewi->id);
});

it('returns no leaves for an empty month', function () {
    leaveCalendar($this->mentor, '?month=2027-01')->assertOk()->assertJsonPath('data.leaves', []);
});

it('rejects an invalid month and other roles', function () {
    leaveCalendar($this->mentor, '?month=10-2026')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['month' => 'Format bulan tidak valid.']);

    app('auth')->forgetGuards();
    leaveCalendar(User::factory()->admin()->create())->assertForbidden();
});
