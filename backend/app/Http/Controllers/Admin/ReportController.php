<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\PdfReportRequest;
use App\Http\Requests\Admin\ReportRequest;
use App\Models\User;
use App\Services\AdminPdfReports;
use App\Services\AdminReports;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Date;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ReportController extends Controller
{
    public const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    public const PDF = 'application/pdf';

    /** Dokumen berisi data pribadi (NIM, nilai): browser dan proxy tidak boleh menyimpan salinannya. */
    public const NO_STORE = ['Cache-Control' => 'no-store, private', 'Pragma' => 'no-cache'];

    public function __construct(private AdminReports $reports, private AdminPdfReports $pdfs) {}

    public function options(): JsonResponse
    {
        return response()->json(['data' => $this->reports->options()]);
    }

    public function preview(ReportRequest $request): JsonResponse
    {
        return response()->json(['data' => ['interns' => $this->reports->preview($request->filters())]]);
    }

    public function export(ReportRequest $request): BinaryFileResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $file = $this->reports->export($admin, $request->filters(), Date::now());

        return response()
            ->download($file['path'], $file['filename'], ['Content-Type' => self::XLSX, ...self::NO_STORE])
            ->deleteFileAfterSend();
    }

    public function attendancePdf(PdfReportRequest $request): Response
    {
        /** @var User $admin */
        $admin = $request->user();

        return $this->pdf($this->pdfs->attendance($admin, $request->intern(), $request->month(), Date::now()));
    }

    public function assessmentPdf(PdfReportRequest $request): Response
    {
        /** @var User $admin */
        $admin = $request->user();

        return $this->pdf($this->pdfs->assessment($admin, $request->intern(), Date::now()));
    }

    /**
     * @param  array{content: string, filename: string}  $file
     */
    private function pdf(array $file): Response
    {
        return response($file['content'], 200, [
            'Content-Type' => self::PDF,
            'Content-Disposition' => 'attachment; filename="'.$file['filename'].'"',
            ...self::NO_STORE,
        ]);
    }
}
